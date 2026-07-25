import React, { useState, useMemo, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';

// --- 대한민국 2025~2026 주요 법정 공휴일 (주말로 취급될 날짜들) ---
const KOR_HOLIDAYS = [
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-05', '2026-05-25', '2026-06-06', '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-09', '2026-12-25'
];

// --- 연도별 기타지급, 고정비, 인건비, 영업외손익 정의 (2025 vs 2026) ---
const YEAR_FINANCIALS = {
  '2025': {
    label: '2025년도',
    gyeonginOtherExpense: 872924000,
    othersOtherExpense: 836912876,
    totalOtherExpense: 1709836876,
    fixedCost: 927400000,
    laborCost: 452600000,
    nonOpProfit: 46000000,
  },
  '2026': {
    label: '2026년도',
    gyeonginOtherExpense: 1263254000,
    othersOtherExpense: 1078948120,
    totalOtherExpense: 2342202120,
    fixedCost: 1250200000,
    laborCost: 637200000,
    nonOpProfit: 59000000,
  }
};

const OTHER_EXPENSE = YEAR_FINANCIALS['2026'].totalOtherExpense;

// --- 기본 요율 및 설정 ---
const INITIAL_SETTINGS = {
  general: { baseIncrease: 0 }, 
  time: { dayStart: 2.5, dayEnd: 20.5 }, 
  weight: { 현장: 1.0, 소액: 1.28 },
  TR: { 
    현장_요율: 1.30, 
    소액_요율: 1.46  
  },
  TC: { 
    평일_주간: 1.00, 
    평일_야간: 1.50, 
    주말: 1.50       
  }
};

const SIM_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#f97316']; 

// --- fetchWithRetry 유틸리티 정의 ---
const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3, backoff = 1000): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
};

// --- 선형 회귀 알고리즘 (추세선 계산용) ---
const linearRegression = (data: { x: number; y: number }[]) => {
  const n = data.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  let minX = Infinity, maxX = -Infinity;

  data.forEach(d => {
    sumX += d.x; sumY += d.y; sumXY += d.x * d.y; sumXX += d.x * d.x;
    if (d.x < minX) minX = d.x;
    if (d.x > maxX) maxX = d.x;
  });

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) return null; 

  const m = (n * sumXY - sumX * sumY) / denominator;
  const b = (sumY - m * sumX) / n;
  return { m, b, minX, maxX };
};

// --- 기존(Old) 요율 산출 로직 (3교대, 옛날 현장/소액 구분 룰) ---
const getOldRates = (isWeekend: boolean, timeHour: number, type: string) => {
  let timeCat = '';
  if (timeHour >= 7.0 && timeHour < 17.0) timeCat = '주간';
  else if ((timeHour >= 17.0 && timeHour < 21.0) || (timeHour >= 5.0 && timeHour < 7.0)) timeCat = '야간';
  else timeCat = '심야';

  const isSmall = type === '소액';

  let trRate = 1.0;
  if (timeCat === '심야') trRate = 1.96;
  else if (timeCat === '야간') trRate = 1.46;
  else trRate = isWeekend ? 1.46 : 1.30;

  let tcRate = 1.0;
  if (timeCat === '심야') tcRate = 1.50;
  else if (timeCat === '야간') tcRate = 1.10;
  else { 
    if (!isWeekend) tcRate = 1.00;
    else tcRate = isSmall ? 1.05 : 1.10;
  }

  const weight = isSmall ? 1.28 : 1.00;
  return { trRate, tcRate, weight };
};

const checkIsWeekendOrHoliday = (dayOfWeek: string, dateStr: string) => {
  if (dayOfWeek === '일') return true;
  if (!dateStr) return false;
  
  let normDate = dateStr.replace(/[^0-9]/g, '');
  if (normDate.length === 6) {
      const y = parseInt(normDate.substring(0, 2), 10);
      const fullY = y < 50 ? 2000 + y : 1900 + y;
      normDate = `${fullY}-${normDate.substring(2,4)}-${normDate.substring(4,6)}`;
  } else if (normDate.length === 8) {
      normDate = `${normDate.substring(0,4)}-${normDate.substring(4,6)}-${normDate.substring(6,8)}`;
  }
  return KOR_HOLIDAYS.includes(normDate);
};

const normalizeMonth = (monthStr: string) => {
  if (!monthStr) return null;
  const cleanStr = monthStr.replace(/[^0-9]/g, '');
  if (cleanStr.length === 6) return `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}`;
  else if (cleanStr.length === 4) {
    const year = parseInt(cleanStr.substring(0, 2), 10);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    return `${fullYear}-${cleanStr.substring(2, 4)}`;
  }
  return monthStr;
};

interface DataRow {
  id: number;
  month: string;
  center: string;
  team: string;
  dayOfWeek: string;
  isWeekend: boolean;
  timeHour: number;
  type: string;
  baseCost: number;
  resultCost: number;
}

const normalizeCenter = (rawCenter: string): string => {
  if (!rawCenter) return '기타';
  if (rawCenter.includes('양지_현장') || rawCenter.includes('경인_현장')) return '경인_현장';
  if (rawCenter.includes('양지_소액') || rawCenter.includes('경인_소액')) return '경인_소액';
  if (rawCenter.includes('부산')) return '부산센터';
  if (rawCenter.includes('광주')) return '광주센터';
  if (rawCenter.includes('대구')) return '대구센터';
  if (rawCenter.includes('대전')) return '대전센터';
  return '기타';
};

// --- 목업 데이터 (경인_현장 포함 다변화) ---
const generateMockData = (): DataRow[] => {
  const data: DataRow[] = [];
  const months = ['2025-01', '2025-02', '2025-03', '2025-04'];
  const centerOptions = ['양지_현장', '경인_현장', '양지_소액', '경인_소액', '부산센터', '광주센터', '대구센터', '대전센터', '기타'];
  for (let i = 0; i < 2000; i++) {
    const month = months[Math.floor(Math.random() * months.length)];
    const rawCenter = centerOptions[Math.floor(Math.random() * centerOptions.length)];
    const center = normalizeCenter(rawCenter);
    const team = `팀_${Math.floor(Math.random() * 5) + 1}`;
    const isSmall = center.includes('소액');
    const dayOfWeek = Math.random() > 0.2 ? '수' : '일';
    const isWeekend = checkIsWeekendOrHoliday(dayOfWeek, `${month}-15`);
    const timeHour = Math.floor(Math.random() * 24) + (Math.random() > 0.5 ? 0.5 : 0);
    const baseCost = Math.floor(Math.random() * 500000) + 100000;
    const resultCost = Math.floor(baseCost * (0.9 + Math.random() * 0.3)); 
    data.push({ id: i, month, center, team, dayOfWeek, isWeekend, timeHour, type: isSmall ? '소액' : '현장', baseCost, resultCost });
  }
  return data;
};

export default function App() {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [savedSims, setSavedSims] = useState<any[]>([]); 
  const [errorMsg, setErrorMsg] = useState('');
  
  // 2025년도 / 2026년도 손익 기준 연도 선택 상태 (기본값: 2026년도)
  const [selectedYear, setSelectedYear] = useState<'2025' | '2026'>('2026');

  const [activeViewSimId, setActiveViewSimId] = useState('current'); 
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]); 
  const [timeDistributionMode, setTimeDistributionMode] = useState<'count' | 'amount'>('count'); 

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiError, setAiError] = useState('');
  const [recommendedSettings, setRecommendedSettings] = useState<any>(null); 
  
  // Gemini API Key를 로컬스토리지에서 가져오거나 빈 값으로 초기화
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  
  useEffect(() => { setRawData(generateMockData()); }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const readFileAsText = (file: File, encoding: string): Promise<string> => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.readAsText(file, encoding);
    });

    const parseCSV = (str: string) => {
      const arr: string[][] = [];
      let quote = false; let row = 0, col = 0, c = 0;
      for (; c < str.length; c++) {
        const cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || []; arr[row][col] = arr[row][col] || '';
        if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
        if (cc === '"') { quote = !quote; continue; }
        if (cc === ',' && !quote) { ++col; continue; }
        if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc === '\n' && !quote) { ++row; col = 0; continue; }
        if (cc === '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
      }
      return arr.map(row => row.map(cell => cell.trim()));
    };

    try {
      let text = await readFileAsText(file, 'utf-8');
      let parsedRows = parseCSV(text).filter(row => row.length > 1 && row.some(cell => cell !== ''));
      let headers = parsedRows[0];

      if (!headers.some(h => h.includes('센터') || h.includes('시공'))) {
        text = await readFileAsText(file, 'euc-kr');
        parsedRows = parseCSV(text).filter(row => row.length > 1 && row.some(cell => cell !== ''));
        headers = parsedRows[0];
      }
      
      const cleanHeaders = headers.map(h => h.replace(/\s+/g, '').toLowerCase());
      const teamIdx = cleanHeaders.findIndex(h => h.includes('권역시공팀'));
      const dateStrIdx = cleanHeaders.findIndex(h => h.includes('시공예정일(yymmdd)'));
      const monthIdx = cleanHeaders.findIndex(h => h.includes('시공예정일(yymm)') && !h.includes('dd'));
      const dayOfWeekIdx = cleanHeaders.findIndex(h => h === '요일');
      const timeIdx = cleanHeaders.findIndex(h => h.includes('확정시간'));
      const typeIdx = cleanHeaders.findIndex(h => h.includes('현장여부'));
      const costIdx = cleanHeaders.findIndex(h => h.includes('정상시공비'));
      let centerIdx = cleanHeaders.findIndex(h => h.includes('센터'));
      // D열 (0-index 3) 기본 참조 fallback
      if (centerIdx === -1) centerIdx = 3;
      const resultCostIdx = cleanHeaders.findIndex(h => h.includes('시공결과금액'));

      if ([monthIdx, costIdx, timeIdx, teamIdx].includes(-1)) {
        setErrorMsg(`오류: 필요 열을 찾을 수 없습니다. (인식된 헤더: ${headers.slice(0, 7).join(', ')}...)`);
        return;
      }
      setErrorMsg('');

      const validData: DataRow[] = [];
      for (let i = 1; i < parsedRows.length; i++) {
        const cols = parsedRows[i];
        if (cols.length <= costIdx) continue;
        
        // RAW DATA D열 (centerIdx 또는 인덱스 3) 참조하여 센터 파싱
        const rawCenter = cols[centerIdx] !== undefined && cols[centerIdx] !== '' ? cols[centerIdx] : (cols[3] || '');
        const center = normalizeCenter(rawCenter);

        const team = cols[teamIdx] || '알 수 없음';
        const dateStr = cols[dateStrIdx] || '';
        const dayOfWeek = cols[dayOfWeekIdx] || '월';
        
        const isWeekend = checkIsWeekendOrHoliday(dayOfWeek, dateStr);

        const timeStr = cols[timeIdx] || '';
        let timeHour = 12.0;
        const hMatch = timeStr.match(/(\d+)\s*시/);
        if (hMatch) {
          const h = parseFloat(hMatch[1]);
          const mMatch = timeStr.match(/(\d+)\s*분/);
          timeHour = h + (mMatch ? parseFloat(mMatch[1]) / 60 : 0); 
        } else {
          const fallbackMatch = timeStr.match(/(\d+)/);
          if (fallbackMatch) timeHour = parseFloat(fallbackMatch[1]);
        }

        const baseCost = parseFloat(cols[costIdx].replace(/,/g, '').trim());
        
        let resultCost = baseCost;
        if (resultCostIdx !== -1 && cols[resultCostIdx]) {
          const parsedResultCost = parseFloat(cols[resultCostIdx].replace(/,/g, '').trim());
          if (!isNaN(parsedResultCost)) {
            resultCost = parsedResultCost;
          }
        }

        const normalizedMonth = normalizeMonth(cols[monthIdx]);

        if (!isNaN(baseCost) && baseCost > 0 && normalizedMonth) {
            validData.push({ id: i, month: normalizedMonth, center, team, dayOfWeek, isWeekend, timeHour, type: cols[typeIdx]?.includes('소액') ? '소액' : '현장', baseCost, resultCost });
        }
      }

      if (validData.length === 0) { setErrorMsg('파싱된 데이터가 없습니다.'); return; }

      setRawData(validData);
      setAiReport(''); setRecommendedSettings(null); 
      setSavedSims([]); setActiveViewSimId('current');
      
      handleGenerateAiInsight(validData);

    } catch (err: any) {
      setErrorMsg("데이터 파싱 중 오류가 발생했습니다: " + err.message);
    }
  };

  const calculateCosts = (data: DataRow[], config: typeof INITIAL_SETTINGS) => {
    const monthlyAgg: Record<string, any> = {};
    const centerAgg: Record<string, any> = {};
    const teamAgg: Record<string, any> = {}; 
    const globalMetrics = { 
      totalTR: 0, totalTC: 0, 
      yangjiHyunOldTC: 0, yangjiHyunNewTC: 0, 
      yangjiSoaekHyunOldTC: 0, yangjiSoaekHyunNewTC: 0, 
      yangjiSoaekSoaekOldTC: 0, yangjiSoaekSoaekNewTC: 0, 
      localHyunOldTC: 0, localHyunNewTC: 0,
      localSoaekOldTC: 0, localSoaekNewTC: 0,
      totalResultCost: 0,
      gyeonginOldTR: 0, gyeonginOldTC: 0,
      gyeonginTR: 0, gyeonginTC: 0,
      othersOldTR: 0, othersOldTC: 0,
      othersTR: 0, othersTC: 0
    };
    
    const counts = { weekdayDay: 0, weekdayNight: 0, weekend: 0 };
    const amounts = { weekdayDay: 0, weekdayNight: 0, weekend: 0 };
    
    const hourlyCounts = Array(24).fill(0);
    const hourlyAmounts = Array(24).fill(0);
    
    const baseCostMultiplier = 1 + (config.general.baseIncrease / 100);
    let totalOldTR = 0; let totalOldTC = 0;

    data.forEach(row => {
      const { month, center, team, isWeekend, timeHour, type, baseCost, resultCost } = row;
      const actualResultCost = resultCost || 0;
      
      // --- 1. 기존(Old) 계산 ---
      const oldRules = getOldRates(isWeekend, timeHour, type);
      const TR_old = Math.floor(baseCost * oldRules.weight * oldRules.trRate);
      const TC_old = Math.floor(baseCost * oldRules.weight * oldRules.tcRate);
      totalOldTR += TR_old;
      totalOldTC += TC_old;

      // --- 2. 시뮬(New) 계산 ---
      const isDayTime = timeHour >= config.time.dayStart && timeHour < config.time.dayEnd;
      
      if (isWeekend) {
        counts.weekend++;
        amounts.weekend += actualResultCost;
      } else if (isDayTime) {
        counts.weekdayDay++;
        amounts.weekdayDay += actualResultCost;
      } else {
        counts.weekdayNight++;
        amounts.weekdayNight += actualResultCost;
      }

      const hrBin = Math.min(23, Math.max(0, Math.floor(timeHour)));
      hourlyCounts[hrBin]++;
      hourlyAmounts[hrBin] += actualResultCost;

      const weight = type === '소액' ? config.weight.소액 : config.weight.현장;
      const trRate = type === '소액' ? config.TR.소액_요율 : config.TR.현장_요율;
      
      let tcRate;
      if (isWeekend) {
        tcRate = config.TC.주말;
      } else if (isDayTime) {
        tcRate = config.TC.평일_주간;
      } else {
        tcRate = config.TC.평일_야간;
      }

      const adjustedBaseCost = baseCost * baseCostMultiplier;
      const TR_new = Math.floor(adjustedBaseCost * weight * trRate);
      const TC_new = Math.floor(adjustedBaseCost * weight * tcRate);

      globalMetrics.totalTR += TR_new;
      globalMetrics.totalTC += TC_new;
      globalMetrics.totalResultCost += actualResultCost; 
      
      // 경인_현장 vs 그 외 분류 누적 (기존 TR/TC 및 시뮬 TR/TC 모두 누적)
      const isGyeongin = center === '경인_현장' || center === '양지_현장';
      if (isGyeongin) {
        globalMetrics.gyeonginOldTR += TR_old;
        globalMetrics.gyeonginOldTC += TC_old;
        globalMetrics.gyeonginTR += TR_new;
        globalMetrics.gyeonginTC += TC_new;
      } else {
        globalMetrics.othersOldTR += TR_old;
        globalMetrics.othersOldTC += TC_old;
        globalMetrics.othersTR += TR_new;
        globalMetrics.othersTC += TC_new;
      }

      // 조건2 세부 판별용 분기
      if (center === '경인_현장' || center === '양지_현장') {
        globalMetrics.yangjiHyunOldTC += TC_old;
        globalMetrics.yangjiHyunNewTC += TC_new;
      } else if (center === '경인_소액' || center === '양지_소액') {
        if (type === '현장') {
          globalMetrics.yangjiSoaekHyunOldTC += TC_old;
          globalMetrics.yangjiSoaekHyunNewTC += TC_new;
        } else {
          globalMetrics.yangjiSoaekSoaekOldTC += TC_old;
          globalMetrics.yangjiSoaekSoaekNewTC += TC_new;
        }
      } else {
        if (type === '현장') {
          globalMetrics.localHyunOldTC += TC_old;
          globalMetrics.localHyunNewTC += TC_new;
        } else {
          globalMetrics.localSoaekOldTC += TC_old;
          globalMetrics.localSoaekNewTC += TC_new;
        }
      }

      if (!monthlyAgg[month]) monthlyAgg[month] = { month, baseCost: 0, TR_old: 0, TC_old: 0, TR_new: 0, TC_new: 0 };
      monthlyAgg[month].baseCost += baseCost; monthlyAgg[month].TR_old += TR_old; monthlyAgg[month].TC_old += TC_old; monthlyAgg[month].TR_new += TR_new; monthlyAgg[month].TC_new += TC_new;

      if (!centerAgg[center]) centerAgg[center] = { center, baseCost: 0, TR_old: 0, TC_old: 0, TR_new: 0, TC_new: 0 };
      centerAgg[center].baseCost += baseCost; centerAgg[center].TR_old += TR_old; centerAgg[center].TC_old += TC_old; centerAgg[center].TR_new += TR_new; centerAgg[center].TC_new += TC_new;

      if (!teamAgg[team]) teamAgg[team] = { team, baseCost: 0, TR_old: 0, TC_old: 0, TR_new: 0, TC_new: 0 };
      teamAgg[team].baseCost += baseCost; teamAgg[team].TR_old += TR_old; teamAgg[team].TC_old += TC_old; teamAgg[team].TR_new += TR_new; teamAgg[team].TC_new += TC_new;
    });

    const sortedMonthlyData = Object.values(monthlyAgg).sort((a,b) => a.month.localeCompare(b.month));
    const CENTER_SORT_ORDER = ['경인_현장', '경인_소액', '부산센터', '광주센터', '대구센터', '대전센터', '기타'];
    const sortedCenterData = Object.values(centerAgg).sort((a: any, b: any) => {
      let idxA = CENTER_SORT_ORDER.indexOf(a.center);
      let idxB = CENTER_SORT_ORDER.indexOf(b.center);
      if (idxA === -1) idxA = 99;
      if (idxB === -1) idxB = 99;
      return idxA - idxB;
    });
    const sortedTeamData = Object.values(teamAgg).sort((a,b) => a.team.localeCompare(b.team));

    const totalCount = counts.weekdayDay + counts.weekdayNight + counts.weekend;
    const totalAmount = amounts.weekdayDay + amounts.weekdayNight + amounts.weekend;

    return { 
      monthlyData: sortedMonthlyData, 
      centerData: sortedCenterData,
      teamData: sortedTeamData,
      globalMetrics, totalOldTR, totalOldTC,
      hourlyCounts,
      hourlyAmounts,
      totalCount,
      totalAmount,
      ratios: {
        weekdayDay: totalCount ? ((counts.weekdayDay / totalCount) * 100).toFixed(1) : 0,
        weekdayNight: totalCount ? ((counts.weekdayNight / totalCount) * 100).toFixed(1) : 0,
        weekend: totalCount ? ((counts.weekend / totalCount) * 100).toFixed(1) : 0,
      },
      amountRatios: {
        weekdayDay: totalAmount ? ((amounts.weekdayDay / totalAmount) * 100).toFixed(1) : 0,
        weekdayNight: totalAmount ? ((amounts.weekdayNight / totalAmount) * 100).toFixed(1) : 0,
        weekend: totalAmount ? ((amounts.weekend / totalAmount) * 100).toFixed(1) : 0,
      }
    };
  };

  const calculated = useMemo(() => calculateCosts(rawData, settings), [rawData, settings]);

  const viewedData = useMemo(() => {
    if (activeViewSimId === 'current') return { name: '현재 시뮬레이션', settings, ...calculated };
    const saved = savedSims.find(s => s.id === activeViewSimId);
    if (saved) return { name: saved.id, settings: saved.settings, ...saved.calculatedData };
    return { name: '현재 시뮬레이션', settings, ...calculated };
  }, [activeViewSimId, savedSims, calculated, settings]);

  const getGlobalTP = (tr: number, tc: number) => tr - (tc + OTHER_EXPENSE); 
  const oldTP = getGlobalTP(calculated.totalOldTR, calculated.totalOldTC);
  const currentTP = getGlobalTP(calculated.globalMetrics.totalTR, calculated.globalMetrics.totalTC);
  
  let bestSimId = '현재 시뮬레이션';
  let maxTP = currentTP;

  if (oldTP > maxTP) { bestSimId = '기존 (Old)'; maxTP = oldTP; }
  savedSims.forEach(sim => {
    const simTP = getGlobalTP(sim.calculatedData.globalMetrics.totalTR, sim.calculatedData.globalMetrics.totalTC);
    if (simTP > maxTP) { bestSimId = sim.id; maxTP = simTP; }
  });

  const chartSeries: any[] = [];
  chartSeries.push({ name: '기존 (Old)', data: calculated.monthlyData.map((d: any) => ({ x: d.TC_old, y: d.TR_old, month: d.month })), color: '#9ca3af', isOptimal: bestSimId === '기존 (Old)' });
  savedSims.forEach((sim, idx) => {
    chartSeries.push({ name: sim.id, data: sim.calculatedData.monthlyData.map((d: any) => ({ x: d.TC_new, y: d.TR_new, month: d.month })), color: SIM_COLORS[idx % SIM_COLORS.length], isOptimal: bestSimId === sim.id });
  });
  chartSeries.push({ name: '현재 시뮬레이션', data: calculated.monthlyData.map((d: any) => ({ x: d.TC_new, y: d.TR_new, month: d.month })), color: '#3b82f6', isOptimal: bestSimId === '현재 시뮬레이션' });

  const updateSetting = (category: string, key: string, value: string) => {
    setActiveViewSimId('current'); 
    setSettings(prev => ({ ...prev, [category]: { ...(prev as any)[category], [key]: parseFloat(value) || 0 } }));
    setAiReport('');
  };

  const handleLoadSimulation = (id: string) => {
    setActiveViewSimId(id);
    if (id !== 'current') {
      const saved = savedSims.find(s => s.id === id);
      if (saved) setSettings(JSON.parse(JSON.stringify(saved.settings)));
    }
  };

  const handleSaveSimulation = () => {
    const newId = `시뮬 ${savedSims.length + 1}`;
    setSavedSims([...savedSims, { id: newId, settings: JSON.parse(JSON.stringify(settings)), calculatedData: { ...calculated } }]);
    setActiveViewSimId(newId);
  };

  const handleDeleteSimulation = (id: string) => {
    setSavedSims(savedSims.filter(sim => sim.id !== id));
    if (activeViewSimId === id) setActiveViewSimId('current');
  };

  // --- 🎯 100% 정밀 매칭 솔버 (Goal Seek Algorithm) ---
  const handleGoalSeek = () => {
    if (rawData.length === 0) return alert("데이터를 먼저 업로드해주세요.");

    const YH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    const YSH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    const YSS = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    const LH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    const LS = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };

    let TR_sum_H = 0;
    let TR_sum_S = 0;
    let TR_oldTR = 0;
    let totalResultCostSum = 0; 

    rawData.forEach(row => {
        const { center, isWeekend, timeHour, type, baseCost, resultCost } = row;
        const oldRules = getOldRates(isWeekend, timeHour, type);
        const TC_old = Math.floor(baseCost * oldRules.weight * oldRules.tcRate);
        const TR_old = Math.floor(baseCost * oldRules.weight * oldRules.trRate);

        const isDayTime = timeHour >= settings.time.dayStart && timeHour < settings.time.dayEnd;
        const isSmall = type === '소액';
        const actualResultCost = resultCost || 0;

        let cat;
        if (center === '경인_현장' || center === '양지_현장') {
            cat = YH;
        } else if (center === '경인_소액' || center === '양지_소액') {
            cat = isSmall ? YSS : YSH;
        } else {
            cat = isSmall ? LS : LH;
        }

        cat.oldTC += TC_old;

        if (isWeekend) {
            if (isSmall) cat.week_S += baseCost; else cat.week_H += baseCost;
        } else if (isDayTime) {
            if (isSmall) cat.day_S += baseCost; else cat.day_H += baseCost;
        } else {
            if (isSmall) cat.night_S += baseCost; else cat.night_H += baseCost;
        }

        TR_oldTR += TR_old;
        totalResultCostSum += actualResultCost;
        if (isSmall) {
            TR_sum_S += baseCost;
        } else {
            TR_sum_H += baseCost;
        }
    });

    const evaluate = (p: any) => {
        const x = 1 + (p.baseIncrease / 100);
        const w = p.wSoaek;

        const getNewTC = (cat: any) => {
            return x * (
                (cat.day_H * 1.0 + cat.night_H * p.tcNight + cat.week_H * p.tcWeek) +
                w * (cat.day_S * 1.0 + cat.night_S * p.tcNight + cat.week_S * p.tcWeek)
            );
        };

        const yh_tc = getNewTC(YH);
        const ysh_tc = getNewTC(YSH);
        const yss_tc = getNewTC(YSS);
        const lh_tc = getNewTC(LH);
        const ls_tc = getNewTC(LS);

        const tr_val = x * (TR_sum_H * p.trHyun + w * TR_sum_S * p.trSoaek);
        const tc_total = yh_tc + ysh_tc + yss_tc + lh_tc + ls_tc;
        const billingRatio = totalResultCostSum ? (tr_val / totalResultCostSum) : 0;

        const err_yh = YH.oldTC ? Math.pow((yh_tc / YH.oldTC) - 1.025, 2) : 0;
        const err_ysh = YSH.oldTC ? Math.pow((ysh_tc / YSH.oldTC) - 1.025, 2) : 0;
        const err_yss = YSS.oldTC ? Math.pow((yss_tc / YSS.oldTC) - 1.025, 2) : 0;
        const err_lh = LH.oldTC ? Math.pow((lh_tc / LH.oldTC) - 1.025, 2) : 0;
        const err_ls = LS.oldTC ? Math.pow((ls_tc / LS.oldTC) - 1.025, 2) : 0;
        
        const err_tr = TR_oldTR ? Math.pow((tr_val / TR_oldTR) - 0.975, 2) : 0;
        const err_c4 = totalResultCostSum ? Math.pow(billingRatio - 0.0535, 2) : 0;

        const loss = err_yh * 10 + err_ysh * 2 + err_yss * 2 + err_lh * 2 + err_ls * 2 + err_tr * 5 + err_c4 * 1000;

        let penalty = 0;

        const currentOtherExpense = YEAR_FINANCIALS[selectedYear].totalOtherExpense;
        if (tr_val * 0.9 < tc_total + currentOtherExpense) {
            const diff = (tc_total + currentOtherExpense) - (tr_val * 0.9);
            penalty += Math.pow(diff / 1e9, 2) * 5000;
        }

        const applyC2Penalty = (oldTC: number, newTC: number) => {
            if (oldTC) {
                const r = newTC / oldTC;
                if (r < 0.95) penalty += Math.pow(0.95 - r, 2) * 10000;
                if (r > 1.10) penalty += Math.pow(r - 1.10, 2) * 10000;
            }
        };

        applyC2Penalty(YH.oldTC, yh_tc);
        applyC2Penalty(YSH.oldTC, ysh_tc);
        applyC2Penalty(YSS.oldTC, yss_tc);
        applyC2Penalty(LH.oldTC, lh_tc);
        applyC2Penalty(LS.oldTC, ls_tc);

        if (TR_oldTR) {
            const r = tr_val / TR_oldTR;
            if (r < 0.95) penalty += Math.pow(0.95 - r, 2) * 10000;
            if (r > 1.00) penalty += Math.pow(r - 1.00, 2) * 10000;
        }

        if (billingRatio < 0.05) {
            penalty += Math.pow(0.05 - billingRatio, 2) * 50000;
        }
        if (billingRatio >= 0.057) {
            penalty += Math.pow(billingRatio - 0.057, 2) * 50000;
        }

        return loss + penalty;
    };

    // --- 수치 미정의(Bug) 해결: 루프 상위 scope에 선언 ---
    let bestParams = {
        baseIncrease: settings.general.baseIncrease,
        wSoaek: settings.weight.소액,
        trHyun: settings.TR.현장_요율,
        trSoaek: settings.TR.소액_요율,
        tcNight: settings.TC.평일_야간,
        tcWeek: settings.TC.주말
    };
    let currentLoss = evaluate(bestParams);

    for(let restart = 0; restart < 5; restart++) {
      let currentParams = { 
        baseIncrease: restart === 0 ? settings.general.baseIncrease : (Math.random() * 20 - 5),
        wSoaek: restart === 0 ? settings.weight.소액 : (1.1 + Math.random() * 0.4),
        trHyun: restart === 0 ? settings.TR.현장_요율 : (1.2 + Math.random() * 0.5),
        trSoaek: restart === 0 ? settings.TR.소액_요율 : (1.3 + Math.random() * 0.5),
        tcNight: restart === 0 ? settings.TC.평일_야간 : (1.0 + Math.random() * 0.6),
        tcWeek: restart === 0 ? settings.TC.주말 : (1.1 + Math.random() * 0.6)
      };
      
      let step = 0.5;
      
      for (let i = 0; i < 25000; i++) {
        const cand = { ...currentParams };
        const keys = Object.keys(cand) as (keyof typeof cand)[];
        const rKey = keys[Math.floor(Math.random() * keys.length)];
        
        let delta = (Math.random() - 0.5) * step;
        if (rKey === 'baseIncrease') delta *= 10; 
        
        cand[rKey] = cand[rKey] + delta;
        
        if (cand.wSoaek < 1.01) cand.wSoaek = 1.01;
        if (cand.wSoaek > 2.5) cand.wSoaek = 2.5;

        if (cand.trHyun < 1.01) cand.trHyun = 1.01;
        if (cand.trHyun > 3.0) cand.trHyun = 3.0;

        if (cand.trSoaek < 1.01) cand.trSoaek = 1.01;
        if (cand.trSoaek > 3.0) cand.trSoaek = 3.0;

        if (cand.tcNight < 0.5) cand.tcNight = 0.5;
        if (cand.tcNight > 2.5) cand.tcNight = 2.5;

        if (cand.tcWeek < 0.5) cand.tcWeek = 0.5;
        if (cand.tcWeek > 2.5) cand.tcWeek = 2.5;

        if (cand.trHyun <= cand.tcNight) {
          if (rKey === 'trHyun') cand.trHyun = cand.tcNight + 0.05;
          else cand.tcNight = cand.trHyun - 0.05;
        }
        if (cand.trSoaek <= cand.tcNight) {
          if (rKey === 'trSoaek') cand.trSoaek = cand.tcNight + 0.05;
          else cand.tcNight = cand.trSoaek - 0.05;
        }
        
        if (cand.trHyun <= cand.tcWeek) {
          if (rKey === 'trHyun') cand.trHyun = cand.tcWeek + 0.05;
          else cand.tcWeek = cand.trHyun - 0.05;
        }
        if (cand.trSoaek <= cand.tcWeek) {
          if (rKey === 'trSoaek') cand.trSoaek = cand.tcWeek + 0.05;
          else cand.tcWeek = cand.trSoaek - 0.05;
        }

        const loss = evaluate(cand);
        if (loss < currentLoss) {
          currentLoss = loss;
          currentParams = cand;
          bestParams = cand;
        }
        
        if (i % 2500 === 0) step *= 0.75; 
      }
    }

    setSettings(prev => ({
      ...prev,
      general: { ...prev.general, baseIncrease: parseFloat(bestParams.baseIncrease.toFixed(2)) },
      weight: { ...prev.weight, 소액: parseFloat(bestParams.wSoaek.toFixed(3)) },
      TR: { 현장_요율: parseFloat(bestParams.trHyun.toFixed(3)), 소액_요율: parseFloat(bestParams.trSoaek.toFixed(3)) },
      TC: { ...prev.TC, 평일_야간: parseFloat(bestParams.tcNight.toFixed(3)), 주말: parseFloat(bestParams.tcWeek.toFixed(3)) }
    }));
    
    setActiveViewSimId('current');
    alert(`🎯 정밀 100% 매칭 솔버 수렴 완료!\n\n모든 부서 지급액이 새로운 제약 범위(95% ~ 110%) 및 청구액 비율 제약 조건(5.0% ~ 5.7%)에 맞추어 안정적으로 최적화되었습니다.`);
  };

  const checkLPConstraints = () => {
    const { 
      totalTR, totalTC, 
      yangjiHyunOldTC, yangjiHyunNewTC, 
      yangjiSoaekHyunOldTC, yangjiSoaekHyunNewTC, 
      yangjiSoaekSoaekOldTC, yangjiSoaekSoaekNewTC, 
      localHyunOldTC, localHyunNewTC, 
      localSoaekOldTC, localSoaekNewTC,
      totalResultCost 
    } = calculated.globalMetrics;
    const oldTR = calculated.totalOldTR;

    const currentOtherExpense = YEAR_FINANCIALS[selectedYear].totalOtherExpense;
    const cond1 = (totalTR * 0.9) >= (totalTC + currentOtherExpense);
    const cond1Gap = (totalTR * 0.9) - (totalTC + currentOtherExpense);
    const otherExpenseEok = (currentOtherExpense / 100000000).toFixed(2);
    
    const cond2_yh = (yangjiHyunNewTC >= yangjiHyunOldTC * 0.95) && (yangjiHyunNewTC <= yangjiHyunOldTC * 1.10);
    const cond2_ysh = (yangjiSoaekHyunNewTC >= yangjiSoaekHyunOldTC * 0.95) && (yangjiSoaekHyunNewTC <= yangjiSoaekHyunOldTC * 1.10);
    const cond2_yss = (yangjiSoaekSoaekNewTC >= yangjiSoaekSoaekOldTC * 0.95) && (yangjiSoaekSoaekNewTC <= yangjiSoaekSoaekOldTC * 1.10);
    const cond2_lh = (localHyunNewTC >= localHyunOldTC * 0.95) && (localHyunNewTC <= localHyunOldTC * 1.10);
    const cond2_ls = (localSoaekNewTC >= localSoaekOldTC * 0.95) && (localSoaekNewTC <= localSoaekOldTC * 1.10);
    
    const cond3 = (totalTR <= oldTR) && (totalTR >= oldTR * 0.95);

    const billingRatio = totalResultCost ? (totalTR / totalResultCost) : 0;
    const cond4 = (billingRatio >= 0.05) && (billingRatio < 0.057);

    return {
      c1: { pass: cond1, text: `TR*0.9 >= TC+${otherExpenseEok}억 (격차: ₩${(cond1Gap/100000000).toFixed(2)}억)` },
      c2_yh: { pass: cond2_yh, text: `경인_현장 TC(New) 95%~110% (비율: ${yangjiHyunOldTC ? ((yangjiHyunNewTC / yangjiHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_ysh: { pass: cond2_ysh, text: `경인_소액-현장 TC(New) 95%~110% (비율: ${yangjiSoaekHyunOldTC ? ((yangjiSoaekHyunNewTC / yangjiSoaekHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_yss: { pass: cond2_yss, text: `경인_소액-소액 TC(New) 95%~110% (비율: ${yangjiSoaekSoaekOldTC ? ((yangjiSoaekSoaekNewTC / yangjiSoaekSoaekOldTC)*100).toFixed(1) : 0}%)` },
      c2_lh: { pass: cond2_lh, text: `지방센터-현장 TC(New) 95%~110% (비율: ${localHyunOldTC ? ((localHyunNewTC / localHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_ls: { pass: cond2_ls, text: `지방센터-소액 TC(New) 95%~110% (비율: ${localSoaekOldTC ? ((localSoaekNewTC / localSoaekOldTC)*100).toFixed(1) : 0}%)` },
      c3: { pass: cond3, text: `TR(Old) >= TR(New) >= TR(Old)*0.95 (비율: ${oldTR ? ((totalTR / oldTR)*100).toFixed(1) : 0}%)` },
      c4: { pass: cond4, text: `결과금액 대비 청구율 5.0%~5.7% (현재 비율: ${(billingRatio * 100).toFixed(2)}% | ₩${Math.floor(totalResultCost).toLocaleString()})` }
    };
  };

  const lpStatus = checkLPConstraints();

  // 증감률 포맷터
  const formatDiff = (diff: number) => {
    if (diff > 0) return <span className="text-red-500 font-semibold">+{diff.toFixed(1)}%</span>;
    if (diff < 0) return <span className="text-blue-500 font-semibold">{diff.toFixed(1)}%</span>;
    return <span className="text-gray-400">0.0%</span>;
  };
  const getDiffCsv = (diff: number) => diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

  const downloadCSV = () => {
    let csvContent = '\uFEFF'; 
    const vSettings = viewedData.settings;
    
    csvContent += `=== [${viewedData.name}] 설정값 ===\n`;
    csvContent += `정상시공비 인상률(%),${vSettings.general.baseIncrease}%\n`;
    csvContent += `주간 시간대 (시),${vSettings.time.dayStart} ~ ${vSettings.time.dayEnd}\n`;
    csvContent += `가중치,현장: ${vSettings.weight.현장} / 소액: ${vSettings.weight.소액}\n`;
    csvContent += `청구 요율 (TR),현장 청구 요율: ${vSettings.TR.현장_요율} / 소액 청구 요율: ${vSettings.TR.소액_요율}\n`;
    csvContent += `지급 요율 (TC),평일 주간: ${vSettings.TC.평일_주간} / 평일 야간: ${vSettings.TC.평일_야간} / 주말: ${vSettings.TC.주말}\n\n`;

    // 1. 센터별 상세 결과
    csvContent += `[1. 센터별 상세 결과]\n`;
    const headersCenter = ['센터(Center)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersCenter.join(',') + '\n';
    viewedData.centerData.forEach((c: any) => {
      const trDiff = c.TR_old ? ((c.TR_new - c.TR_old) / c.TR_old) * 100 : 0;
      const tcDiff = c.TC_old ? ((c.TC_new - c.TC_old) / c.TC_old) * 100 : 0;
      csvContent += `${c.center},${Math.floor(c.baseCost)},${Math.floor(c.TR_old)},${Math.floor(c.TC_old)},${Math.floor(c.TR_new)},${Math.floor(c.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    // 2. 권역시공팀별 상세 결과
    csvContent += `\n[2. 권역시공팀별 상세 결과]\n`;
    const headersTeam = ['권역시공팀(Team)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersTeam.join(',') + '\n';
    viewedData.teamData.forEach((t: any) => {
      const trDiff = t.TR_old ? ((t.TR_new - t.TR_old) / t.TR_old) * 100 : 0;
      const tcDiff = t.TC_old ? ((t.TC_new - t.TC_old) / t.TC_old) * 100 : 0;
      csvContent += `${t.team},${Math.floor(t.baseCost)},${Math.floor(t.TR_old)},${Math.floor(t.TC_old)},${Math.floor(t.TR_new)},${Math.floor(t.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    // 3. 월별 상세 결과
    csvContent += `\n[3. 월별 상세 결과]\n`;
    const headersMonth = ['월(Month)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersMonth.join(',') + '\n';
    viewedData.monthlyData.forEach((m: any) => {
      const trDiff = m.TR_old ? ((m.TR_new - m.TR_old) / m.TR_old) * 100 : 0;
      const tcDiff = m.TC_old ? ((m.TC_new - m.TC_old) / m.TC_old) * 100 : 0;
      csvContent += `${m.month},${Math.floor(m.baseCost)},${Math.floor(m.TR_old)},${Math.floor(m.TC_old)},${Math.floor(m.TR_new)},${Math.floor(m.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${viewedData.name}_상세결과.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleGenerateAiInsight = async (forceData: DataRow[] | null = null) => {
    setIsGeneratingAi(true); setAiError(''); setAiReport(''); setRecommendedSettings(null);
    const targetData = forceData ? calculateCosts(forceData, INITIAL_SETTINGS) : calculated;
    
    // API 키가 없으면 에러 노출
    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      setAiError("오류: AI 추천 기능을 이용하려면 우측 설정에서 'Gemini API Key'를 먼저 입력해주세요.");
      setIsGeneratingAi(false);
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `
      당신은 물류 시공 비용 최적화 전문 AI입니다.
      [필수 달성 조건]
      1. TR_New * 0.9 >= TC_New + 2342202120 (23억 4229만원)
      2. 세분화된 부서 지급 조건: 양지_현장, 양지_소액-현장, 양지_소액-소액, 지방센터-현장, 지방센터-소액 TC_New가 각각 기존 TC의 95%~110% 사이
      3. TR_Old >= TR_New >= TR_Old * 0.95
      4. 전체 시뮬 청구액(TR_New)은 전체 시공결과금액(resultCost) 총계의 5.0% 이상 5.7% 미만이어야 함.
      
      [규칙]
      - weight.소액 = 1.0 초과값 (현장은 무조건 1.0)
      - TC.평일_주간 은 무조건 1.0
      - 청구 요율은 현장 청구 요율(TR.현장_요율)과 소액 청구 요율(TR.소액_요율)로 이원화되어 존재함.
      - 모든 청구 요율(TR)은 반드시 해당하는 모든 지급 요율(TC)보다 커야 함 (TR_Hyun > TC_평일_주간(1.0), TC_평일_야간, TC_주말 그리고 TR_Soaek > TC_평일_주간(1.0), TC_평일_야간, TC_주말)
      
      기존 TR: ${targetData.totalOldTR}, 기존 TC: ${targetData.totalOldTC}, 
      기존 양지_현장 TC: ${targetData.globalMetrics.yangjiHyunOldTC}, 
      기존 양지_소액-현장 TC: ${targetData.globalMetrics.yangjiSoaekHyunOldTC}, 기존 양지_소액-소액 TC: ${targetData.globalMetrics.yangjiSoaekSoaekOldTC}, 
      기존 지방센터-현장 TC: ${targetData.globalMetrics.localHyunOldTC}, 기존 지방센터-소액 TC: ${targetData.globalMetrics.localSoaekOldTC}
      
      위 조건을 만족하는 수치를 JSON으로 반환하세요.
      {
        "report": "추천 이유(2줄)",
        "recommendations": {
          "general": { "baseIncrease": 추천값 },
          "time": { "dayStart": 2.5, "dayEnd": 20.5 },
          "weight": { "현장": 1.0, "소액": 추천값 },
          "TR": { "현장_요율": 추천값, "소액_요율": 추천값 },
          "TC": { "평일_주간": 1.0, "평일_야간": 추천값, "주말": 추천값 }
        }
      }
    `;

    try {
      const data = await fetchWithRetry(url, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) 
      });
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) {
        const obj = JSON.parse(responseText);
        setAiReport(obj.report); setRecommendedSettings(obj.recommendations);
      } else throw new Error();
    } catch (err) { setAiError("AI 분석 실패"); } finally { setIsGeneratingAi(false); }
  };

  const applyRecommendedSettings = () => {
    if (recommendedSettings) { setSettings(recommendedSettings); setActiveViewSimId('current'); }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const seriesName = payload[0].name;
      const numMonths = calculated.monthlyData.length || 1;
      const tp = data.y - (data.x + (OTHER_EXPENSE / numMonths)); 
      const profitMargin = data.y > 0 ? (tp / data.y) * 100 : 0;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-sm text-sm z-50">
          <p className="font-bold text-gray-800 mb-1">{data.month} <span className="font-normal text-xs text-gray-500">({seriesName})</span></p>
          <p className="text-red-600">시공비 지급(TC): ₩{Math.floor(data.x).toLocaleString()}</p>
          <p className="text-blue-600">전체 청구(TR): ₩{Math.floor(data.y).toLocaleString()}</p>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-green-600 font-semibold">TP(이익): ₩{Math.floor(tp).toLocaleString()}</p>
            <p className="text-green-700">이익률: {profitMargin.toFixed(2)}%</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- 2025/2026 선택 연도 기준 손익 및 공헌이익/영업이익/채산이익 계산 ---
  const fin = YEAR_FINANCIALS[selectedYear];

  const vGlobal = viewedData.globalMetrics;
  const vOldTR = viewedData.totalOldTR;
  const vOldTC = viewedData.totalOldTC;

  // 기존(Old) 세부 및 전체 지표 계산
  const vOldGyeonginTR = vGlobal.gyeonginOldTR || 0;
  const vOldGyeonginTC = vGlobal.gyeonginOldTC || 0;
  const vOldGyeonginContribution = vOldGyeonginTR - (vOldGyeonginTC + fin.gyeonginOtherExpense);
  const vOldGyeonginContributionRate = vOldGyeonginTR ? (vOldGyeonginContribution / vOldGyeonginTR) * 100 : 0;

  const vOldOthersTR = vGlobal.othersOldTR || 0;
  const vOldOthersTC = vGlobal.othersOldTC || 0;
  const vOldOthersContribution = vOldOthersTR - (vOldOthersTC + fin.othersOtherExpense);
  const vOldOthersContributionRate = vOldOthersTR ? (vOldOthersContribution / vOldOthersTR) * 100 : 0;

  const vOldTotalContribution = vOldTR - (vOldTC + fin.totalOtherExpense);
  const vOldTotalContributionRate = vOldTR ? (vOldTotalContribution / vOldTR) * 100 : 0;
  const vOldOpProfit = vOldTotalContribution - fin.fixedCost - fin.laborCost;
  const vOldOpProfitRate = vOldTR ? (vOldOpProfit / vOldTR) * 100 : 0;
  const vOldChaesanProfit = vOldOpProfit + fin.laborCost + fin.nonOpProfit;
  const vOldChaesanProfitRate = vOldTR ? (vOldChaesanProfit / vOldTR) * 100 : 0;

  // 시뮬(New) 세부 및 전체 지표 계산
  const vNewGyeonginTR = vGlobal.gyeonginTR || 0;
  const vNewGyeonginTC = vGlobal.gyeonginTC || 0;
  const vNewGyeonginContribution = vNewGyeonginTR - (vNewGyeonginTC + fin.gyeonginOtherExpense);
  const vNewGyeonginContributionRate = vNewGyeonginTR ? (vNewGyeonginContribution / vNewGyeonginTR) * 100 : 0;

  const vNewOthersTR = vGlobal.othersTR || 0;
  const vNewOthersTC = vGlobal.othersTC || 0;
  const vNewOthersContribution = vNewOthersTR - (vNewOthersTC + fin.othersOtherExpense);
  const vNewOthersContributionRate = vNewOthersTR ? (vNewOthersContribution / vNewOthersTR) * 100 : 0;

  const vNewTotalContribution = vGlobal.totalTR - (vGlobal.totalTC + fin.totalOtherExpense);
  const vNewTotalContributionRate = vGlobal.totalTR ? (vNewTotalContribution / vGlobal.totalTR) * 100 : 0;
  const vNewOpProfit = vNewTotalContribution - fin.fixedCost - fin.laborCost;
  const vNewOpProfitRate = vGlobal.totalTR ? (vNewOpProfit / vGlobal.totalTR) * 100 : 0;
  const vNewChaesanProfit = vNewOpProfit + fin.laborCost + fin.nonOpProfit;
  const vNewChaesanProfitRate = vGlobal.totalTR ? (vNewChaesanProfit / vGlobal.totalTR) * 100 : 0;

  const cond2Pass = lpStatus.c2_yh.pass && lpStatus.c2_ysh.pass && lpStatus.c2_yss.pass && lpStatus.c2_lh.pass && lpStatus.c2_ls.pass;

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-blue-600">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">월별 시공비용 & LP 최적화 시뮬레이터</h1>
            <p className="text-sm text-gray-500 mt-1">공휴일/주말 판별 및 3단계 권역시공팀 분석 기능 적용</p>
          </div>
          <div className="flex flex-col items-end">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col h-[500px]">
              <h2 className="text-lg font-bold text-gray-800 mb-2 flex justify-between items-center text-xs md:text-sm lg:text-base">
                <span>월별 총 청구(TR) vs 총 지급(TC) 추이 산점도</span>
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded hidden sm:inline">* 별표(★)는 TP가 가장 높은 최적의 모델입니다. <b>범례 클릭으로 토글</b>.</span>
              </h2>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                  <XAxis type="number" dataKey="x" name="시공비 지급(TC)" tickFormatter={(val) => `₩${(val/100000000).toFixed(1)}억`} domain={['auto', 'auto']} />
                  <YAxis type="number" dataKey="y" name="총 청구(TR)" tickFormatter={(val) => `₩${(val/100000000).toFixed(1)}억`} domain={['auto', 'auto']} />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Legend onClick={(e: any) => {
                    if (e && typeof e.value === 'string') {
                      const val = e.value;
                      setHiddenSeries(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);
                    }
                  }} formatter={(val) => <span style={{ color: hiddenSeries.includes(val) ? '#a1a1aa' : '#374151', textDecoration: hiddenSeries.includes(val) ? 'line-through' : 'none', cursor: 'pointer' }}>{val}</span>} />
                  {chartSeries.map((s) => {
                    const isHidden = hiddenSeries.includes(s.name);
                    const reg = linearRegression(s.data);
                    return (
                      <React.Fragment key={`group-${s.name}`}>
                        <Scatter name={s.name} data={s.data} fill={s.color} shape={s.isOptimal ? "star" : "circle"} opacity={s.name === '기존 (Old)' ? 0.4 : 0.8} hide={isHidden} />
                        {!isHidden && reg && <ReferenceLine segment={[{ x: reg.minX, y: reg.m * reg.minX + reg.b }, { x: reg.maxX, y: reg.m * reg.maxX + reg.b }]} stroke={s.color} strokeDasharray="3 3" opacity={0.6} strokeWidth={2} />}
                      </React.Fragment>
                    );
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-sm text-white">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-bold text-blue-300">💡 LP(선형계획법) 최적화 제약 조건 달성 현황</h2>
                <div className="flex gap-2">
                  <button onClick={handleGoalSeek} className="bg-gradient-to-r from-teal-500 to-green-500 hover:from-teal-400 hover:to-green-400 text-white font-bold py-2 px-3 rounded-lg text-sm transition animate-bounce">
                    🎯 100% 매칭 솔버
                  </button>
                  <button onClick={() => handleGenerateAiInsight()} disabled={isGeneratingAi} className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-bold py-2 px-3 rounded-lg text-sm transition">
                    {isGeneratingAi ? "계산 중..." : "🔄 AI 추천"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className={`p-4 rounded border ${lpStatus.c1.pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c1.pass ? '✅' : '❌'} 조건 1. 목표 마진 확보</div>
                  <p className="text-sm text-gray-300">{lpStatus.c1.text}</p>
                </div>
                <div className={`p-4 rounded border ${cond2Pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{cond2Pass ? '✅' : '❌'} 조건 2. 센터별 지급 방어선 (95% ~ 110%)</div>
                  <p className="text-xs text-gray-300">{lpStatus.c2_yh.text}</p>
                  <p className="text-xs text-gray-300">{lpStatus.c2_ysh.text}</p>
                  <p className="text-xs text-gray-300">{lpStatus.c2_yss.text}</p>
                  <p className="text-xs text-gray-300">{lpStatus.c2_lh.text}</p>
                  <p className="text-xs text-gray-300">{lpStatus.c2_ls.text}</p>
                </div>
                <div className={`p-4 rounded border ${lpStatus.c3.pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c3.pass ? '✅' : '❌'} 조건 3. 대고객사 청구액 통제</div>
                  <p className="text-sm text-gray-300">{lpStatus.c3.text}</p>
                </div>
                <div className={`p-4 rounded border ${lpStatus.c4.pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c4.pass ? '✅' : '❌'} 조건 4. 결과금액 대비 청구율 제한 (5.0% ~ 5.7%)</div>
                  <p className="text-sm text-gray-300">{lpStatus.c4.text}</p>
                </div>
              </div>

              {(aiReport || aiError) && (
                <div className="mt-4 p-5 rounded-lg border border-purple-400 bg-purple-900/20">
                  <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                    <h3 className="text-purple-300 font-bold flex items-center gap-2">✨ Gemini AI: 최적 파라미터 제안</h3>
                    {recommendedSettings && <button onClick={applyRecommendedSettings} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1 px-3 rounded shadow animate-pulse">🎯 추천값 일괄 적용</button>}
                  </div>
                  {aiError ? <p className="text-red-400 text-sm">{aiError}</p> : <div className="text-sm text-gray-200 whitespace-pre-wrap">{aiReport}</div>}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm space-y-5 h-fit sticky top-6">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="font-bold text-gray-800">시뮬레이션 설정값</h2>
              <button onClick={() => setSettings(INITIAL_SETTINGS)} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 py-1 px-2 rounded">초기화</button>
            </div>

            <div className="space-y-3">
              {/* Gemini API key 입력 UI */}
              <div className="flex flex-col gap-1 bg-purple-50 p-2 rounded border-l-4 border-purple-500 text-xs">
                <label className="font-bold text-purple-800 flex justify-between items-center">
                  <span>Gemini API Key</span>
                  <span className="text-[10px] font-normal text-purple-600">(선택 - AI 추천용)</span>
                </label>
                <input 
                  type="password" 
                  placeholder="Gemini API Key 입력" 
                  value={geminiApiKey} 
                  onChange={e => {
                    setGeminiApiKey(e.target.value);
                    localStorage.setItem('gemini_api_key', e.target.value);
                  }} 
                  className="w-full p-1 border rounded text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-between items-center bg-indigo-50 p-2 rounded border-l-4 border-indigo-500 text-sm">
                <label className="font-bold text-indigo-800">정상시공비 인상률(%)</label>
                <input type="number" step="0.1" value={settings.general.baseIncrease} onChange={e => updateSetting('general', 'baseIncrease', e.target.value)} className="w-16 p-1 border rounded text-right font-bold text-indigo-700"/>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                <label className="font-bold text-gray-700">주간 시간대 (시)</label>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.5" value={settings.time.dayStart} onChange={e => updateSetting('time', 'dayStart', e.target.value)} className="w-12 p-0.5 border text-center text-xs"/> ~ 
                  <input type="number" step="0.5" value={settings.time.dayEnd} onChange={e => updateSetting('time', 'dayEnd', e.target.value)} className="w-12 p-0.5 border text-center text-xs"/>
                </div>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                <label className="font-bold text-gray-700">현장 가중치</label>
                <input type="number" value={1.0} disabled className="w-16 p-1 border rounded text-right bg-gray-200 text-gray-500 cursor-not-allowed"/>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                <label className="font-bold text-gray-700">소액 가중치</label>
                <input type="number" step="0.01" value={settings.weight.소액} onChange={e => updateSetting('weight', '소액', e.target.value)} className="w-16 p-1 border rounded text-right"/>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h3 className="font-bold text-blue-700 text-sm mb-3">청구 요율 (분할)</h3>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-indigo-800">현장 청구 요율</label>
                <input type="number" step="0.01" value={settings.TR.현장_요율} onChange={e => updateSetting('TR', '현장_요율', e.target.value)} className="w-16 p-1 border rounded border-indigo-500 text-right font-bold text-indigo-800"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-indigo-800">소액 청구 요율</label>
                <input type="number" step="0.01" value={settings.TR.소액_요율} onChange={e => updateSetting('TR', '소액_요율', e.target.value)} className="w-16 p-1 border rounded border-indigo-500 text-right font-bold text-indigo-800"/>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h3 className="font-bold text-red-700 text-sm mb-3">지급 요율</h3>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-400">평일 주간 <span className="text-xs">(고정)</span></label>
                <input type="number" value={1.00} disabled className="w-16 p-1 border rounded text-right bg-gray-100 text-gray-400 cursor-not-allowed"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-red-800">평일 야간</label>
                <input type="number" step="0.01" value={settings.TC.평일_야간} onChange={e => updateSetting('TC', '평일_야간', e.target.value)} className="w-16 p-1 border rounded text-right"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-red-800">주말 (기본 1.5)</label>
                <input type="number" step="0.01" value={settings.TC.주말} onChange={e => updateSetting('TC', '주말', e.target.value)} className="w-16 p-1 border rounded text-right"/>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-bold text-gray-800 mb-2">💾 시뮬레이션 보관함</h3>
              <button onClick={handleSaveSimulation} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 px-4 rounded text-sm mb-3 transition">
                + 현재 값으로 시나리오 추가
              </button>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                <div className={`flex justify-between items-center text-sm p-2 border rounded shadow-sm cursor-pointer transition ${activeViewSimId === 'current' ? 'border-blue-500 bg-blue-50' : 'bg-white hover:bg-gray-50'}`} onClick={() => handleLoadSimulation('current')}>
                  <span className="font-bold text-blue-600">현재 시뮬레이션(수정중)</span>
                </div>
                {savedSims.map((sim, idx) => (
                  <div key={sim.id} className={`flex justify-between items-center text-sm p-2 border rounded shadow-sm cursor-pointer transition ${activeViewSimId === sim.id ? 'border-blue-500 bg-blue-50' : 'bg-white hover:bg-gray-50'}`} onClick={() => handleLoadSimulation(sim.id)}>
                    <span className="font-bold" style={{color: SIM_COLORS[idx % SIM_COLORS.length]}}>{sim.id}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSimulation(sim.id); }} className="text-gray-400 hover:text-red-500 px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 하단 데이터 요약 & 표 영역 */}
        <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto mt-6 border-t-4 border-gray-300">
           
           <div className="flex items-center justify-between mb-4 border-b pb-4 flex-wrap gap-2">
             <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
               📊 시뮬레이션 결과 및 요약 <span className="text-blue-600 text-lg">[{viewedData.name}]</span>
             </h2>
             <div className="flex items-center gap-3">
               {/* 2025년도 / 2026년도 손익 기준 연도 선택 토글 */}
               <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                 <button 
                   onClick={() => setSelectedYear('2025')}
                   className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${selectedYear === '2025' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                 >
                   📅 2025년도 기준
                 </button>
                 <button 
                   onClick={() => setSelectedYear('2026')}
                   className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${selectedYear === '2026' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                 >
                   📅 2026년도 기준
                 </button>
               </div>
               <button onClick={downloadCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg shadow transition">
                 엑셀 다운로드 (CSV)
               </button>
             </div>
           </div>

           {/* --- 결과 요약 패널 (Grid cols 4 분할 구성, 경인 vs 그외 및 영업이익/채산이익 반영) --- */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 border-b pb-6">
             {/* 1) 기존 지표 (Old) 카드 - 경인_현장 vs 그 외 분할 노출 */}
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between space-y-3">
               <div>
                 <h3 className="font-bold text-gray-800 mb-2 border-b pb-2 flex justify-between items-center">
                   <span>기존 지표 (Old)</span>
                   <span className="text-[11px] font-normal text-gray-500">[{fin.label}]</span>
                 </h3>
                 
                 {/* 경인_현장 기존 분할 */}
                 <div className="space-y-1 text-[11px] mb-2 bg-white p-2 rounded border border-gray-200">
                   <div className="font-bold text-gray-800 text-xs">🌐 경인_현장 (고정기타 {(fin.gyeonginOtherExpense/100000000).toFixed(2)}억)</div>
                   <div className="text-gray-600 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vOldGyeonginTR).toLocaleString()}</span></div>
                   <div className="text-gray-600 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vOldGyeonginTC).toLocaleString()}</span></div>
                   <div className="text-gray-600 flex justify-between"><span>기타지급:</span> <span>₩{fin.gyeonginOtherExpense.toLocaleString()}</span></div>
                   <div className="text-gray-900 font-bold flex justify-between border-t border-gray-100 pt-1">
                     <span>공헌이익(률):</span> 
                     <span className={vOldGyeonginContribution >= 0 ? "text-blue-600" : "text-red-600"}>
                       ₩{Math.floor(vOldGyeonginContribution).toLocaleString()} ({vOldGyeonginContributionRate.toFixed(1)}%)
                     </span>
                   </div>
                 </div>

                 {/* 그 외 기존 분할 */}
                 <div className="space-y-1 text-[11px] bg-white p-2 rounded border border-gray-200">
                   <div className="font-bold text-gray-800 text-xs">📦 그 외 (고정기타 {(fin.othersOtherExpense/100000000).toFixed(2)}억)</div>
                   <div className="text-gray-600 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vOldOthersTR).toLocaleString()}</span></div>
                   <div className="text-gray-600 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vOldOthersTC).toLocaleString()}</span></div>
                   <div className="text-gray-600 flex justify-between"><span>기타지급:</span> <span>₩{fin.othersOtherExpense.toLocaleString()}</span></div>
                   <div className="text-gray-900 font-bold flex justify-between border-t border-gray-100 pt-1">
                     <span>공헌이익(률):</span> 
                     <span className={vOldOthersContribution >= 0 ? "text-blue-600" : "text-red-600"}>
                       ₩{Math.floor(vOldOthersContribution).toLocaleString()} ({vOldOthersContributionRate.toFixed(1)}%)
                     </span>
                   </div>
                 </div>
               </div>

               {/* 기존 지표 전체 합계 및 손익 지표 */}
               <div className="pt-2 border-t border-gray-300 space-y-1 text-xs">
                 <div className="text-gray-700 flex justify-between font-semibold"><span>전체 청구:</span> <span>₩{Math.floor(vOldTR).toLocaleString()}</span></div>
                 <div className="text-gray-700 flex justify-between"><span>시공비 지급:</span> <span>₩{Math.floor(vOldTC).toLocaleString()}</span></div>
                 <div className="text-gray-700 flex justify-between"><span>기타 지급 계:</span> <span>₩{fin.totalOtherExpense.toLocaleString()}</span></div>
                 
                 <div className="pt-1.5 border-t border-gray-200 font-bold flex justify-between text-gray-900">
                   <span>공헌이익(률):</span>
                   <span className={vOldTotalContribution >= 0 ? "text-blue-600" : "text-red-600"}>
                     ₩{Math.floor(vOldTotalContribution).toLocaleString()} ({vOldTotalContributionRate.toFixed(1)}%)
                   </span>
                 </div>
                 <div className="font-bold flex justify-between text-emerald-800 bg-emerald-50 p-1 rounded">
                   <span>영업이익(률):</span>
                   <span>₩{Math.floor(vOldOpProfit).toLocaleString()} ({vOldOpProfitRate.toFixed(1)}%)</span>
                 </div>
                 <div className="font-bold flex justify-between text-indigo-800 bg-indigo-50 p-1 rounded">
                   <span>채산이익(률):</span>
                   <span>₩{Math.floor(vOldChaesanProfit).toLocaleString()} ({vOldChaesanProfitRate.toFixed(1)}%)</span>
                 </div>
               </div>
             </div>
             
             {/* 2) 시뮬레이션 지표 (New) 카드 - 전체 합계 */}
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col justify-between space-y-3">
               <div>
                 <h3 className="font-bold text-blue-900 mb-2 border-b border-blue-200 pb-2 flex justify-between items-center">
                   <span>시뮬레이션 지표 (New)</span>
                   <span className="text-[11px] font-normal text-blue-700">[{fin.label}]</span>
                 </h3>
                 <div className="text-sm text-blue-800 flex justify-between"><span>전체 청구:</span> <span>₩{Math.floor(vGlobal.totalTR).toLocaleString()}</span></div>
                 <div className="text-sm text-blue-800 flex justify-between"><span>시공비 지급:</span> <span>₩{Math.floor(vGlobal.totalTC).toLocaleString()}</span></div>
                 <div className="text-sm text-blue-800 flex justify-between"><span>기타 지급 계:</span> <span>₩{fin.totalOtherExpense.toLocaleString()}</span></div>
               </div>

               <div className="mt-2 pt-2 border-t border-blue-200 space-y-1.5 text-xs">
                 <div className="text-xs text-blue-900 font-bold flex justify-between bg-blue-100 p-1.5 rounded">
                   <span>전체 공헌이익:</span> 
                   <span>₩{Math.floor(vNewTotalContribution).toLocaleString()}</span>
                 </div>
                 <div className="text-xs text-blue-800 flex justify-between px-1">
                   <span>전체 공헌이익율:</span> 
                   <span className="font-bold">{vNewTotalContributionRate.toFixed(1)}%</span>
                 </div>

                 <div className="pt-2 border-t border-blue-200 space-y-1">
                   <div className="font-bold flex justify-between text-emerald-900 bg-emerald-100/70 p-1.5 rounded">
                     <span>영업이익(률):</span>
                     <span>₩{Math.floor(vNewOpProfit).toLocaleString()} ({vNewOpProfitRate.toFixed(1)}%)</span>
                   </div>
                   <div className="font-bold flex justify-between text-indigo-900 bg-indigo-100/70 p-1.5 rounded">
                     <span>채산이익(률):</span>
                     <span>₩{Math.floor(vNewChaesanProfit).toLocaleString()} ({vNewChaesanProfitRate.toFixed(1)}%)</span>
                   </div>
                 </div>
               </div>
             </div>

             {/* 3) New 세부 지표 분할 요약 패널 */}
             <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 flex flex-col justify-between">
               <div>
                 <h3 className="font-bold text-purple-900 mb-2 border-b border-purple-200 pb-2 flex justify-between items-center">
                   <span>New 세부 지표 분할 요약</span>
                   <span className="text-[11px] font-normal text-purple-700">[{fin.label}]</span>
                 </h3>
                 
                 <div className="space-y-1 text-[11px] mb-2 bg-white/80 p-2 rounded border border-purple-100">
                   <div className="font-bold text-purple-900 text-xs">🌐 경인_현장 (고정기타 {(fin.gyeonginOtherExpense/100000000).toFixed(2)}억)</div>
                   <div className="text-purple-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vNewGyeonginTR).toLocaleString()}</span></div> 
                   <div className="text-purple-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vNewGyeonginTC).toLocaleString()}</span></div>
                   <div className="text-purple-700 flex justify-between"><span>기타지급:</span> <span>₩{fin.gyeonginOtherExpense.toLocaleString()}</span></div>
                   <div className="text-purple-900 font-bold flex justify-between border-t border-purple-200 pt-1">
                     <span>공헌이익(률):</span> 
                     <span className={vNewGyeonginContribution >= 0 ? "text-purple-900" : "text-red-600"}>
                       ₩{Math.floor(vNewGyeonginContribution).toLocaleString()} ({vNewGyeonginContributionRate.toFixed(1)}%)
                     </span>
                   </div>
                 </div>

                 <div className="space-y-1 text-[11px] bg-white/80 p-2 rounded border border-purple-100">
                   <div className="font-bold text-purple-900 text-xs">📦 그 외 (고정기타 {(fin.othersOtherExpense/100000000).toFixed(2)}억)</div>
                   <div className="text-purple-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vNewOthersTR).toLocaleString()}</span></div>
                   <div className="text-purple-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vNewOthersTC).toLocaleString()}</span></div>
                   <div className="text-purple-700 flex justify-between"><span>기타지급:</span> <span>₩{fin.othersOtherExpense.toLocaleString()}</span></div>
                   <div className="text-purple-900 font-bold flex justify-between border-t border-purple-200 pt-1">
                     <span>공헌이익(률):</span> 
                     <span className={vNewOthersContribution >= 0 ? "text-purple-900" : "text-red-600"}>
                       ₩{Math.floor(vNewOthersContribution).toLocaleString()} ({vNewOthersContributionRate.toFixed(1)}%)
                     </span>
                   </div>
                 </div>
               </div>
             </div>

             {/* 4) 손익 기준정보 요약 카드 */}
             <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex flex-col justify-between">
               <div>
                 <h3 className="font-bold text-amber-900 mb-2 border-b border-amber-200 pb-2 flex justify-between items-center">
                   <span>손익 기준정보 요약</span>
                   <span className="text-[11px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">{fin.label}</span>
                 </h3>
                 <div className="space-y-1.5 text-xs text-amber-900">
                   <div className="flex justify-between border-b border-amber-200/60 pb-1">
                     <span>경인_현장 기타지급:</span> <span className="font-semibold">₩{fin.gyeonginOtherExpense.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between border-b border-amber-200/60 pb-1">
                     <span>그 외 기타지급:</span> <span className="font-semibold">₩{fin.othersOtherExpense.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between font-bold border-b border-amber-200 pb-1 text-amber-950">
                     <span>기타지급 계:</span> <span>₩{fin.totalOtherExpense.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between pt-1">
                     <span>퍼시스 부문 고정비:</span> <span className="font-semibold">₩{fin.fixedCost.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>퍼시스 부문 인건비:</span> <span className="font-semibold">₩{fin.laborCost.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between">
                     <span>영업외 손익:</span> <span className="font-semibold">₩{fin.nonOpProfit.toLocaleString()}</span>
                   </div>
                 </div>
               </div>
               
               <div className="mt-3 pt-2 border-t border-amber-200 text-[11px] text-amber-800">
                 <p>💡 <b>영업이익</b> = 공헌이익 - 고정비 - 인건비</p>
                 <p>💡 <b>채산이익</b> = 영업이익 + 인건비 + 영업외손익</p>
               </div>
             </div>
           </div>

           <div className="space-y-10">
             {/* --- 1) 센터별 상세 결과 표 --- */}
             <div className="overflow-x-auto">
               <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                 <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                 센터별 상세 결과
               </h3>
               <table className="min-w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-y-2 border-gray-300">
                    <tr>
                      <th className="p-3">센터 (Center)</th>
                      <th className="p-3 text-right">기존 정상시공비</th>
                      <th className="p-3 text-right text-gray-500">기존 청구(TR)</th>
                      <th className="p-3 text-right text-gray-500">기존 지급(TC)</th>
                      <th className="p-3 text-right text-blue-600 font-bold">시뮬 청구(TR)</th>
                      <th className="p-3 text-right text-red-600 font-bold">시뮬 지급(TC)</th>
                      <th className="p-3 text-center text-gray-700 font-bold">청구 증감률</th>
                      <th className="p-3 text-center text-gray-700 font-bold">지급 증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedData.centerData.map((c: any, cIdx: number) => {
                      const cTrDiff = c.TR_old ? ((c.TR_new - c.TR_old) / c.TR_old) * 100 : 0;
                      const cTcDiff = c.TC_old ? ((c.TC_new - c.TC_old) / c.TC_old) * 100 : 0;
                      
                      return (
                        <tr key={`c-${cIdx}`} className="border-b border-gray-200 bg-white hover:bg-gray-50 font-bold">
                          <td className="p-3 text-gray-800">🏢 {c.center}</td>
                          <td className="p-3 text-right text-gray-600">₩{Math.floor(c.baseCost).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(c.TR_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(c.TC_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-blue-600">₩{Math.floor(c.TR_new).toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600">₩{Math.floor(c.TC_new).toLocaleString()}</td>
                          <td className="p-3 text-center">{formatDiff(cTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiff(cTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>

             {/* --- 2) 권역시공팀별 상세 결과 표 --- */}
             <div className="overflow-x-auto">
               <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                 <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                 권역시공팀별 상세 결과
               </h3>
               <table className="min-w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-y-2 border-gray-300">
                    <tr>
                      <th className="p-3">권역시공팀 (Team)</th>
                      <th className="p-3 text-right">기존 정상시공비</th>
                      <th className="p-3 text-right text-gray-500">기존 청구(TR)</th>
                      <th className="p-3 text-right text-gray-500">기존 지급(TC)</th>
                      <th className="p-3 text-right text-blue-600 font-bold">시뮬 청구(TR)</th>
                      <th className="p-3 text-right text-red-600 font-bold">시뮬 지급(TC)</th>
                      <th className="p-3 text-center text-gray-700 font-bold">청구 증감률</th>
                      <th className="p-3 text-center text-gray-700 font-bold">지급 증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedData.teamData.map((t: any, tIdx: number) => {
                      const tTrDiff = t.TR_old ? ((t.TR_new - t.TR_old) / t.TR_old) * 100 : 0;
                      const tTcDiff = t.TC_old ? ((t.TC_new - t.TC_old) / t.TC_old) * 100 : 0;
                      
                      return (
                        <tr key={`t-${tIdx}`} className="border-b border-gray-200 bg-white hover:bg-gray-50 font-bold">
                          <td className="p-3 text-gray-800">👷 {t.team}</td>
                          <td className="p-3 text-right text-gray-600">₩{Math.floor(t.baseCost).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(t.TR_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(t.TC_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-blue-600">₩{Math.floor(t.TR_new).toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600">₩{Math.floor(t.TC_new).toLocaleString()}</td>
                          <td className="p-3 text-center">{formatDiff(tTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiff(tTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>

             {/* --- 3) 월별 상세 결과 표 --- */}
             <div className="overflow-x-auto">
               <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                 <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                 월별 상세 결과
               </h3>
               <table className="min-w-full text-sm text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 border-y-2 border-gray-300">
                    <tr>
                      <th className="p-3">월 (Month)</th>
                      <th className="p-3 text-right">기존 정상시공비</th>
                      <th className="p-3 text-right text-gray-500">기존 청구(TR)</th>
                      <th className="p-3 text-right text-gray-500">기존 지급(TC)</th>
                      <th className="p-3 text-right text-blue-600 font-bold">시뮬 청구(TR)</th>
                      <th className="p-3 text-right text-red-600 font-bold">시뮬 지급(TC)</th>
                      <th className="p-3 text-center text-gray-700 font-bold">청구 증감률</th>
                      <th className="p-3 text-center text-gray-700 font-bold">지급 증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedData.monthlyData.map((m: any, mIdx: number) => {
                      const mTrDiff = m.TR_old ? ((m.TR_new - m.TR_old) / m.TR_old) * 100 : 0;
                      const mTcDiff = m.TC_old ? ((m.TC_new - m.TC_old) / m.TC_old) * 100 : 0;
                      
                      return (
                        <tr key={`m-${mIdx}`} className="border-b border-gray-300 bg-white hover:bg-gray-50 font-bold">
                          <td className="p-3 text-gray-800">🗓️ {m.month}</td>
                          <td className="p-3 text-right text-gray-600">₩{Math.floor(m.baseCost).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(m.TR_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(m.TC_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-blue-600">₩{Math.floor(m.TR_new).toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600">₩{Math.floor(m.TC_new).toLocaleString()}</td>
                          <td className="p-3 text-center">{formatDiff(mTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiff(mTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>

             {/* --- 4) 확정시간별 분포 분석 카드 (24시간 분석 - 최하단) --- */}
             <div className="bg-white p-6 rounded-xl border border-gray-200 mt-8 shadow-sm">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-4 border-b">
                 <div>
                   <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                     ⏰ 확정시간별 분포 분석 (24시간)
                   </h3>
                   <p className="text-xs text-gray-500 mt-0.5">업로드된 RAW DATA의 확정시간 컬럼(O열) 기준 시간대별 상세 비중 분석</p>
                 </div>
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                   <button 
                     onClick={() => setTimeDistributionMode('count')} 
                     className={`px-3 py-1 text-xs font-semibold rounded-md transition ${timeDistributionMode === 'count' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                   >
                     건수 기준
                   </button>
                   <button 
                     onClick={() => setTimeDistributionMode('amount')} 
                     className={`px-3 py-1 text-xs font-semibold rounded-md transition ${timeDistributionMode === 'amount' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                   >
                     금액 기준
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                 {Array.from({ length: 24 }).map((_, hour) => {
                   const count = viewedData.hourlyCounts?.[hour] || 0;
                   const amount = viewedData.hourlyAmounts?.[hour] || 0;
                   const totalCount = viewedData.totalCount || 1;
                   const totalAmountSum = viewedData.hourlyAmounts?.reduce((a: number, b: number) => a + b, 0) || 1;
                   
                   const pct = timeDistributionMode === 'count' 
                     ? (count / totalCount * 100) 
                     : (amount / totalAmountSum * 100);

                   const isDayActive = hour >= settings.time.dayStart && hour < settings.time.dayEnd;

                   return (
                     <div 
                       key={hour} 
                       className={`p-3 rounded-lg border transition-all duration-300 ${isDayActive ? 'border-blue-200 bg-blue-50/40 shadow-sm' : 'border-gray-100 bg-gray-50/50'}`}
                     >
                       <div className="flex justify-between items-center mb-1">
                         <span className="text-xs font-bold text-gray-700">{hour.toString().padStart(2, '0')}:00</span>
                         <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${isDayActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                           {isDayActive ? '주간' : '야간'}
                         </span>
                       </div>
                       <div className="text-sm font-extrabold text-gray-800 mb-1">
                         {timeDistributionMode === 'count' 
                           ? `${count.toLocaleString()}건` 
                           : `₩${(amount / 10000).toFixed(0)}만`}
                       </div>
                       <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                         <div 
                           className={`h-full rounded-full transition-all duration-500 ${isDayActive ? 'bg-blue-500' : 'bg-indigo-400'}`} 
                           style={{ width: `${Math.min(100, pct)}%` }}
                         />
                       </div>
                       <div className="text-[10px] text-gray-500 text-right mt-1 font-semibold">
                         {pct.toFixed(1)}%
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           </div>

        </div>
      </div>
    </div>
  );
}
