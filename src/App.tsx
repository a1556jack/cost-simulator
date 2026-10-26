import React, { useState, useMemo, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';

// 대한민국 2024~2026 주요 법정 공휴일 (주말로 취급될 날짜들)
const KOR_HOLIDAYS = [
  '2024-01-01', '2024-02-09', '2024-02-10', '2024-02-11', '2024-02-12', '2024-03-01', '2024-04-10', '2024-05-05', '2024-05-06', '2024-05-15', '2024-06-06', '2024-08-15', '2024-09-16', '2024-09-17', '2024-09-18', '2024-10-01', '2024-10-03', '2024-10-09', '2024-12-25',
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-05', '2025-05-06', '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-06', '2025-10-07', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-05', '2026-05-25', '2026-06-06', '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-09', '2026-12-25'
];

// 연도별 기타지급 고정 비용 정의
const EXPENSE_DATA_BY_YEAR: Record<string, {
  total: number;
  gyeonginHyun: number;
  gyeonginSoaek: number;
  jibang: number;
  gyeongin: number;
  others: number;
  hyun: number;
  soaek: number;
}> = {
  '2024': {
    total: 1573592194,         // 기타지급비용 합계: 1,573,592,194원 (815,102,000 + 585,242,134 + 173,248,060)
    gyeonginHyun: 815102000,   // 경인_현장 기타지급: 815,102,000원
    gyeonginSoaek: 585242134,  // 경인_소액 기타지급: 585,242,134원
    jibang: 173248060,         // 지방 소액지급: 173,248,060원
    gyeongin: 815102000,       // 경인_현장 기타지급 (하위 호환)
    others: 758490194,        // 경인_소액 + 지방 합계: 758,490,194원 (585,242,134 + 173,248,060)
    hyun: 815102000,          // 현장 기타지급: 815,102,000원 (경인_현장)
    soaek: 758490194          // 소액 기타지급: 758,490,194원 (경인_소액 5.85억 + 지방 소액 1.73억)
  },
  '2025': {
    total: 1717643760,         // 기타지급비용 합계: 1,717,643,760원
    gyeonginHyun: 850501000,   // 경인_현장 기타지급: 850,501,000원
    gyeonginSoaek: 480879760,  // 경인_소액 기타지급: 480,879,760원
    jibang: 386263000,         // 지방 기타지급: 386,263,000원
    gyeongin: 850501000,       // 경인_현장 기타지급 (하위 호환)
    others: 867142760,        // 경인_소액 + 지방 합계: 867,142,760원
    hyun: 978477000,          // 현장 기타지급: 978,477,000원
    soaek: 739166760          // 소액 기타지급: 739,166,760원
  },
  '2026': {
    total: 1379452049,         // 기타지급비용 합계: 1,379,452,049원
    gyeonginHyun: 765647000,   // 경인_현장 기타지급: 765,647,000원
    gyeonginSoaek: 193448439,  // 경인_소액 기타지급: 193,448,439원
    jibang: 271011730,         // 지방 기타지급: 271,011,730원
    gyeongin: 765647000,       // 경인_현장 기타지급 (하위 호환)
    others: 464460169,        // 경인_소액 + 지방 합계: 464,460,169원 (193,448,439 + 271,011,730)
    hyun: 855423277,          // 현장 기타지급: 855,423,277원 (경인_현장 7.66억 + 지방 안분)
    soaek: 374683892          // 소액 기타지급: 374,683,892원 (경인_소액 1.93억 + 지방 안분)
  }
};

const EXPENSE_DATA = EXPENSE_DATA_BY_YEAR['2025']; // 기본값 (하위 호환용)

// 연도별 고정 재무 지표 (고정비, 인건비, 영업외손익)
const FINANCIAL_DATA_BY_YEAR: Record<string, {
  fixedCost: number;
  laborCost: number;
  nonOpProfit: number;
}> = {
  '2024': {
    fixedCost: 713112564,   // 퍼시스 24년도 고정비 (713,112,564원)
    laborCost: 439006331,   // 퍼시스 24년도 인건비 (439,006,331원)
    nonOpProfit: 0,         // 퍼시스 24년도 영업외손익 (0원)
  },
  '2025': {
    fixedCost: 924600000,   // 퍼시스 25년도 고정비 (9.246억)
    laborCost: 452600000,   // 퍼시스 25년도 인건비 (4.526억)
    nonOpProfit: 46000000,  // 퍼시스 25년도 영업외손익 (0.46억)
  },
  '2026': {
    fixedCost: 737100000,   // 퍼시스 26년도 고정비 (7.371억)
    laborCost: 373500000,   // 퍼시스 26년도 인건비 (3.735억)
    nonOpProfit: 28000000,  // 퍼시스 26년도 영업외손익 (0.28억)
  },
  'ALL': {
    fixedCost: 2374812564,  // 전체 합계 고정비 (23.75억) = 24년(7.13억) + 25년(9.25억) + 26년(7.37억)
    laborCost: 1265106331,  // 전체 합계 인건비 (12.65억) = 24년(4.39억) + 25년(4.53억) + 26년(3.74억)
    nonOpProfit: 74000000,  // 전체 합계 영업외손익 (0.74억)
  }
};

const FURSYS_FIXED_COST = 924600000; // 하위 호환용 기본값 (2025 기준)
const FURSYS_LABOR_COST = 452600000;
const NON_OP_PROFIT = 46000000;

const INITIAL_SETTINGS = {
  general: { baseIncrease: 0 }, 
  time: { dayStart: 2.5, dayEnd: 20.5 }, 
  weight: { 
    gyeonginHyunjang: 1.0,               // 경인 현장 가중치
    gyeonginSoaekJibangHyunjang: 1.0,    // 경인 소액/지방 현장 가중치
    gyeonginSoaekHyunjang: 1.0,          // 호환용
    jibangHyunjang: 1.0,                 // 호환용
    hyunjang: 1.0,                       // 호환용
    soaek: 1.28                          // 소액 가중치
  },
  TR: { 
    hyunjangRate: 1.30, 
    soaekRate: 1.46,
    gyeonginHyunjangRate: 1.30,
    gyeonginSoaekRate: 1.46,
    jibangRate: 1.30
  },
  TC: { 
    weekdayDay: 1.00, 
    weekdayNight: 1.00, 
    weekend: 1.00       
  }
};

const SIM_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#f97316']; 

const linearRegression = (data) => {
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

const getOldRates = (isWeekend, timeHour, type) => {
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

  const weight = 1.00;
  return { trRate, tcRate, weight };
};

const checkIsWeekendOrHoliday = (dayOfWeek, dateStr) => {
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

const MONTH_NAMES: { [key: string]: string } = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

const normalizeMonth = (monthStr: any) => {
  if (!monthStr) return null;
  const raw = String(monthStr).trim();
  if (!raw) return null;

  // 1) 영문 월 매칭 (예: 25-Jan, Jan-25, 2025-Feb 등)
  const lower = raw.toLowerCase();
  for (const [mName, mNum] of Object.entries(MONTH_NAMES)) {
    if (lower.includes(mName)) {
      const numMatch = raw.match(/\d+/);
      if (numMatch) {
        let yr = parseInt(numMatch[0], 10);
        if (numMatch[0].length === 2) {
          yr = yr < 50 ? 2000 + yr : 1900 + yr;
        }
        return `${yr}-${mNum}`;
      }
    }
  }

  // 2) 숫자 기반 정규화
  const cleanStr = raw.replace(/[^0-9]/g, '');
  if (cleanStr.length === 6) {
    return `${cleanStr.substring(0, 4)}-${cleanStr.substring(4, 6)}`;
  } else if (cleanStr.length === 4) {
    const year = parseInt(cleanStr.substring(0, 2), 10);
    const fullYear = year < 50 ? 2000 + year : 1900 + year;
    return `${fullYear}-${cleanStr.substring(2, 4)}`;
  }
  return raw;
};

const getYearFromMonth = (monthStr: string) => {
  if (!monthStr) return '';
  const s = String(monthStr).trim();
  const m4 = s.match(/(20\d{2})/);
  if (m4) return m4[1];
  const m2 = s.match(/^(\d{2})/);
  if (m2) {
    const y = parseInt(m2[1], 10);
    return String(y < 50 ? 2000 + y : 1900 + y);
  }
  return s.substring(0, 4);
};

// 7개 세부 센터명 정규화
const normalizeCenterName = (rawCenter) => {
  if (!rawCenter) return '기타';
  const clean = rawCenter.trim().replace(/\s+/g, '');
  if (clean.includes('경인현장') || clean.includes('양지현장') || clean === '양지_현장' || clean === '경인_현장' || (clean.includes('경인') && !clean.includes('소액'))) return '경인_현장';
  if (clean.includes('경인소액') || clean.includes('양지소액') || clean === '양지_소액' || clean === '경인_소액' || clean.includes('소액')) return '경인_소액';
  if (clean.includes('부산')) return '부산센터';
  if (clean.includes('광주')) return '광주센터';
  if (clean.includes('대구')) return '대구센터';
  if (clean.includes('대전')) return '대전센터';
  return '기타';
};

const generateMockData = () => {
  const data = [];
  const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2025-01', '2025-02', '2025-03', '2025-04'];
  const centers = ['경인_현장', '경인_소액', '부산센터', '광주센터', '대구센터', '대전센터', '기타'];
  for (let i = 0; i < 2000; i++) {
    const month = months[Math.floor(Math.random() * months.length)];
    const center = centers[Math.floor(Math.random() * centers.length)];
    const team = `팀_${Math.floor(Math.random() * 5) + 1}`;
    const isSmall = center === '경인_소액' || (Math.random() > 0.8); 
    const dayOfWeek = Math.random() > 0.2 ? '수' : '일';
    const isWeekend = checkIsWeekendOrHoliday(dayOfWeek, `${month}-15`);
    const timeHour = Math.floor(Math.random() * 24) + (Math.random() > 0.5 ? 0.5 : 0);
    const baseCost = Math.floor(Math.random() * 500000) + 100000;
    const resultCost = Math.floor(baseCost * (0.9 + Math.random() * 0.3)); 
    data.push({ id: i, month, center, team, dayOfWeek, isWeekend, timeHour, type: isSmall ? '소액' : '현장', baseCost, resultCost });
  }
  return data;
};

const calculateCosts = (data, config) => {
  const monthlyAgg = {};
  const centerAgg = {};
  const teamAgg = {}; 
  
  let globalMetrics = { 
    totalTR: 0, totalTC: 0, 
    yangjiHyunOldTC: 0, yangjiHyunNewTC: 0, 
    yangjiSoaekHyunOldTC: 0, yangjiSoaekHyunNewTC: 0, 
    yangjiSoaekSoaekOldTC: 0, yangjiSoaekSoaekNewTC: 0, 
    localHyunOldTC: 0, localHyunNewTC: 0,
    localSoaekOldTC: 0, localSoaekNewTC: 0,
    hyunOldTR: 0, hyunNewTR: 0, hyunOldTC: 0, hyunNewTC: 0,
    soaekOldTR: 0, soaekNewTR: 0, soaekOldTC: 0, soaekNewTC: 0,
    gyeonginBase: 0, othersHyunBase: 0, othersSoaekBase: 0,
    totalResultCost: 0,
    gyeonginTR: 0, gyeonginTC: 0, gyeonginOldTR: 0, gyeonginOldTC: 0,
    gyeonginSoaekTR: 0, gyeonginSoaekTC: 0, gyeonginSoaekOldTR: 0, gyeonginSoaekOldTC: 0,
    jibangTR: 0, jibangTC: 0, jibangOldTR: 0, jibangOldTC: 0,
    othersTR: 0, othersTC: 0, othersOldTR: 0, othersOldTC: 0
  };
  
  let counts = { weekdayDay: 0, weekdayNight: 0, weekend: 0 };
  let amounts = { weekdayDay: 0, weekdayNight: 0, weekend: 0 };
  let hourlyCounts = Array(24).fill(0);
  let hourlyAmounts = Array(24).fill(0);
  
  const baseCostMultiplier = 1 + (config.general.baseIncrease / 100);
  let totalOldTR = 0; let totalOldTC = 0;

  data.forEach(row => {
    const { month, center, team, isWeekend, timeHour, type, baseCost, resultCost } = row;
    const actualResultCost = resultCost || 0;
    
    const isSmall = type === '소액';
    const oldRules = getOldRates(isWeekend, timeHour, type);
    const TR_old = Math.floor(baseCost * oldRules.trRate);
    const TC_old = Math.floor(baseCost * oldRules.tcRate);
    totalOldTR += TR_old;
    totalOldTC += TC_old;

    const isDayTime = timeHour >= config.time.dayStart && timeHour < config.time.dayEnd;
    
    if (isWeekend) {
      counts.weekend++; amounts.weekend += actualResultCost;
    } else if (isDayTime) {
      counts.weekdayDay++; amounts.weekdayDay += actualResultCost;
    } else {
      counts.weekdayNight++; amounts.weekdayNight += actualResultCost;
    }

    const hrBin = Math.min(23, Math.max(0, Math.floor(timeHour)));
    hourlyCounts[hrBin]++;
    hourlyAmounts[hrBin] += actualResultCost;

    const isGyeonginHyun = center === '경인_현장' || center === '양지_현장';
    const isGyeonginSoaek = center === '경인_소액' || center === '양지_소액';
    
    // 청구(TR) 가중치: 소액만 소액가중치 적용, 현장은 1.0 고정
    const trWeight = type === '소액' ? (config.weight.soaek ?? 1.28) : 1.0;
    
    // 지급(TC) 가중치:
    // 1) 소액건: config.weight.soaek
    // 2) 경인 현장: config.weight.gyeonginHyunjang
    // 3) 경인 소액/지방 현장: config.weight.gyeonginSoaekJibangHyunjang
    let tcWeight = 1.0;
    if (type === '소액') {
      tcWeight = config.weight.soaek ?? 1.28;
    } else if (isGyeonginHyun) {
      tcWeight = config.weight.gyeonginHyunjang ?? 1.0;
    } else {
      // 경인_소액 센터의 현장건 또는 지방센터의 현장건
      tcWeight = config.weight.gyeonginSoaekJibangHyunjang ?? config.weight.gyeonginSoaekHyunjang ?? config.weight.jibangHyunjang ?? config.weight.hyunjang ?? 1.0;
    }

    const trRate = type === '소액' ? (config.TR.soaekRate ?? 1.46) : (config.TR.hyunjangRate ?? 1.30);
    
    let tcRate;
    if (isWeekend) {
      tcRate = config.TC.weekend;
    } else if (isDayTime) {
      tcRate = config.TC.weekdayDay;
    } else {
      tcRate = config.TC.weekdayNight;
    }

    const baseForNew = isSmall ? Math.floor(baseCost / 1.28) : baseCost;
    const adjustedBaseCost = baseForNew * baseCostMultiplier;
    const TR_new = Math.floor(adjustedBaseCost * trWeight * trRate);
    const TC_new = Math.floor(adjustedBaseCost * tcWeight * tcRate);

    globalMetrics.totalTR += TR_new;
    globalMetrics.totalTC += TC_new;
    globalMetrics.totalResultCost += actualResultCost; 
    
    // 현장 vs 소액 전체 누적
    if (type === '현장') {
      globalMetrics.hyunOldTR += TR_old;
      globalMetrics.hyunNewTR += TR_new;
      globalMetrics.hyunOldTC += TC_old;
      globalMetrics.hyunNewTC += TC_new;
      if (center === '경인_현장' || center === '양지_현장') {
        globalMetrics.gyeonginBase += baseCost;
      } else {
        globalMetrics.othersHyunBase += baseCost;
      }
    } else {
      globalMetrics.soaekOldTR += TR_old;
      globalMetrics.soaekNewTR += TR_new;
      globalMetrics.soaekOldTC += TC_old;
      globalMetrics.soaekNewTC += TC_new;
      globalMetrics.othersSoaekBase += baseCost;
    }

    // 3분할 집계 (경인_현장 vs 경인_소액 vs 지방센터)
    if (center === '경인_현장' || center === '양지_현장') {
      globalMetrics.gyeonginTR += TR_new;
      globalMetrics.gyeonginTC += TC_new;
      globalMetrics.gyeonginOldTR += TR_old;
      globalMetrics.gyeonginOldTC += TC_old;
    } else if (center === '경인_소액' || center === '양지_소액') {
      globalMetrics.gyeonginSoaekTR += TR_new;
      globalMetrics.gyeonginSoaekTC += TC_new;
      globalMetrics.gyeonginSoaekOldTR += TR_old;
      globalMetrics.gyeonginSoaekOldTC += TC_old;

      globalMetrics.othersTR += TR_new;
      globalMetrics.othersTC += TC_new;
      globalMetrics.othersOldTR += TR_old;
      globalMetrics.othersOldTC += TC_old;
    } else {
      globalMetrics.jibangTR += TR_new;
      globalMetrics.jibangTC += TC_new;
      globalMetrics.jibangOldTR += TR_old;
      globalMetrics.jibangOldTC += TC_old;

      globalMetrics.othersTR += TR_new;
      globalMetrics.othersTC += TC_new;
      globalMetrics.othersOldTR += TR_old;
      globalMetrics.othersOldTC += TC_old;
    }

    // 조건2 평가를 위한 5분할 누적
    if (center === '경인_현장') {
      globalMetrics.yangjiHyunOldTC += TC_old;
      globalMetrics.yangjiHyunNewTC += TC_new;
    } else if (center === '경인_소액') {
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

    if (!centerAgg[center]) centerAgg[center] = { center, baseCost: 0, TR_old: 0, TC_old: 0, TR_new: 0, TC_new: 0, teams: {} };
    centerAgg[center].baseCost += baseCost; centerAgg[center].TR_old += TR_old; centerAgg[center].TC_old += TC_old; centerAgg[center].TR_new += TR_new; centerAgg[center].TC_new += TC_new;

    if (!teamAgg[team]) teamAgg[team] = { team, baseCost: 0, TR_old: 0, TC_old: 0, TR_new: 0, TC_new: 0 };
    teamAgg[team].baseCost += baseCost; teamAgg[team].TR_old += TR_old; teamAgg[team].TC_old += TC_old; teamAgg[team].TR_new += TR_new; teamAgg[team].TC_new += TC_new;
  });

  const sortedMonthlyData = Object.values(monthlyAgg).sort((a: any, b: any) => a.month.localeCompare(b.month));
  const sortedCenterData = Object.values(centerAgg).sort((a: any, b: any) => a.center.localeCompare(b.center));
  const sortedTeamData = Object.values(teamAgg).sort((a: any, b: any) => a.team.localeCompare(b.team));

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

const CustomTooltipComponent = ({ active, payload, numMonths, otherExpense }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const seriesName = payload[0].name;
    const monthsVal = numMonths || 1;
    const tp = data.y - (data.x + (otherExpense / monthsVal)); 
    const profitMargin = data.y > 0 ? (tp / data.y) * 100 : 0;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded shadow-sm text-sm z-50 animate-fade-in">
        <p className="font-bold text-gray-800 mb-1">{data.month} <span className="font-normal text-xs text-gray-500">({seriesName})</span></p>
        <p className="text-red-600">시공비 지급(TC): ₩{Math.floor(data.x).toLocaleString()}</p>
        <p className="text-blue-600">전체 청구(TR): ₩{Math.floor(data.y).toLocaleString()}</p>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-green-600 font-semibold">공헌이익: ₩{Math.floor(tp).toLocaleString()}</p>
          <p className="text-green-700">공헌이익율: {profitMargin.toFixed(2)}%</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function App() {
  const [rawData, setRawData] = useState([]);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [savedSims, setSavedSims] = useState([]); 
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  
  const [activeViewSimId, setActiveViewSimId] = useState('current'); 
  const [hiddenSeries, setHiddenSeries] = useState([]); 
  const [timeDistributionMode, setTimeDistributionMode] = useState('count'); 
  const [selectedYear, setSelectedYear] = useState('ALL');

  const currentExpense = useMemo(() => {
    if (selectedYear && EXPENSE_DATA_BY_YEAR[selectedYear]) {
      return EXPENSE_DATA_BY_YEAR[selectedYear];
    }
    const y24 = EXPENSE_DATA_BY_YEAR['2024'];
    const y25 = EXPENSE_DATA_BY_YEAR['2025'];
    const y26 = EXPENSE_DATA_BY_YEAR['2026'];
    return {
      total: y24.total + y25.total + y26.total,
      gyeonginHyun: y24.gyeonginHyun + y25.gyeonginHyun + y26.gyeonginHyun,
      gyeonginSoaek: y24.gyeonginSoaek + y25.gyeonginSoaek + y26.gyeonginSoaek,
      jibang: y24.jibang + y25.jibang + y26.jibang,
      gyeongin: y24.gyeongin + y25.gyeongin + y26.gyeongin,
      others: y24.others + y25.others + y26.others,
      hyun: y24.hyun + y25.hyun + y26.hyun,
      soaek: y24.soaek + y25.soaek + y26.soaek,
    };
  }, [selectedYear]);

  const currentFinancials = useMemo(() => {
    if (selectedYear && FINANCIAL_DATA_BY_YEAR[selectedYear]) {
      return FINANCIAL_DATA_BY_YEAR[selectedYear];
    }
    return FINANCIAL_DATA_BY_YEAR['ALL'];
  }, [selectedYear]);

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiError, setAiError] = useState('');
  const [recommendedSettings, setRecommendedSettings] = useState(null); 
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => { 
    setRawData(generateMockData()); 
    setMounted(true);
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  const handleGenerateAiInsight = async (forceData = null) => {
    setIsGeneratingAi(true); setAiError(''); setAiReport(''); setRecommendedSettings(null);
    const targetData = forceData ? calculateCosts(forceData, INITIAL_SETTINGS) : calculated;
    
    const currentOtherExpense = currentExpense.total;
    
    const apiKey = geminiApiKey.trim();
    if (!apiKey) {
      setAiError("오류: AI 추천 기능을 사용하려면 우측 설정에서 'Gemini API Key'를 먼저 입력해주세요.");
      setIsGeneratingAi(false);
      return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `
      당신은 물류 시공 비용 최적화 전문 AI입니다.
      [필수 달성 조건]
      1. TR_New * 0.9 >= TC_New + ${currentOtherExpense} (${(currentOtherExpense/100000000).toFixed(2)}억)
      2. 세분화된 부서 지급 조건: 경인_현장 TC_New 95%~110%, 경인_소액-현장 105%~120%, 경인_소액-소액 105%~120%, 지방센터-현장 105%~120%, 지방센터-소액 105%~120% 사이
      3. TR_Old >= TR_New >= TR_Old * 0.95
      4. 전체 시뮬 청구액(TR_New)은 전체 시공결과금액(resultCost) 총계의 5.0% 이상 5.7% 미만이어야 함.
      
      [규칙]
      - weight.소액 = 1.0 초과값 (현장은 무조건 1.0)
      - TC.평일_주간 은 무조건 1.0
      - 청구 요율은 현장 청구 요율(TR.hyunjangRate)과 소액 청구 요율(TR.soaekRate)로 이원화되어 존재함.
      - 모든 청구 요율(TR)은 반드시 해당하는 모든 지급 요율(TC)보다 커야 함
      
      위 조건을 만족하는 수치를 JSON으로 반환하세요.
      {
        "report": "추천 이유(2줄)",
        "recommendations": {
          "general": { "baseIncrease": 추천값 },
          "time": { "dayStart": 2.5, "dayEnd": 20.5 },
          "weight": { "gyeonginHyunjang": 1.0, "gyeonginSoaekHyunjang": 1.0, "jibangHyunjang": 1.0, "soaek": 추천값 },
          "TR": { "hyunjangRate": 추천값, "soaekRate": 추천값 },
          "TC": { "weekdayDay": 1.0, "weekdayNight": 추천값, "weekend": 추천값 }
        }
      }
    `;

    try {
      const data = await fetchWithRetry(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) {
        const obj = JSON.parse(responseText);
        const reportString = typeof obj.report === 'string' ? obj.report : JSON.stringify(obj.report);
        setAiReport(reportString); 
        setRecommendedSettings(obj.recommendations);
      } else throw new Error("결과 없음");
    } catch (err: any) { 
      setAiError(String(err.message || "AI 분석 실패")); 
    } finally { 
      setIsGeneratingAi(false); 
    }
  };

  const applyRecommendedSettings = () => {
    if (recommendedSettings) { 
      setSettings(recommendedSettings); 
      setActiveViewSimId('current'); 
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const readFileAsText = (file, encoding) => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsText(file, encoding);
    });

    const parseCSV = (str) => {
      const arr = [];
      let quote = false; let row = 0, col = 0, c = 0;
      for (; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
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
      let teamIdx = cleanHeaders.findIndex(h => h.includes('권역시공팀'));
      let dateStrIdx = cleanHeaders.findIndex(h => h.includes('시공예정일(yymmdd)'));
      let monthIdx = cleanHeaders.findIndex(h => h.includes('시공예정일(yymm)') && !h.includes('dd'));
      let dayOfWeekIdx = cleanHeaders.findIndex(h => h === '요일'); 
      let timeIdx = cleanHeaders.findIndex(h => h.includes('확정시간'));     
      let typeIdx = cleanHeaders.findIndex(h => h.includes('현장여부'));     
      let costIdx = cleanHeaders.findIndex(h => h.includes('정상시공비'));
      let centerIdx = cleanHeaders.findIndex(h => h.includes('센터') || h.includes('물류센터') || h.includes('지점'));
      let resultCostIdx = cleanHeaders.findIndex(h => h.includes('시공결과금액'));

      const numRows = Math.min(50, parsedRows.length);
      for (let col = 0; col < headers.length; col++) {
        let centerCount = 0;
        let dayOfWeekCount = 0;
        let typeCount = 0;
        let timeCount = 0;
        let monthCount = 0;

        for (let r = 1; r < numRows; r++) {
          const val = parsedRows[r][col] || '';
          if (!val) continue;

          if (val.includes('경인') || val.includes('양지') || val.includes('부산') || val.includes('광주') || val.includes('대구') || val.includes('대전')) {
            centerCount++;
          }
          if (['월','화','수','목','금','토','일'].some(day => val.includes(day))) {
            dayOfWeekCount++;
          }
          if (val.includes('현장') || val.includes('소액')) {
            typeCount++;
          }
          if (val.includes('시') || val.includes('분') || (val.includes(':') && val.length < 6)) {
            timeCount++;
          }
          if (/^\d{4}-\d{2}$/.test(val) || /^\d{2}-\d{2}$/.test(val) || /^\d{6}$/.test(val)) {
            monthCount++;
          }
        }

        if (centerIdx === -1 && centerCount > 2) centerIdx = col;
        if (dayOfWeekIdx === -1 && dayOfWeekCount > 5) dayOfWeekIdx = col;
        if (typeIdx === -1 && typeCount > 5) typeIdx = col;
        if (timeIdx === -1 && timeCount > 5) timeIdx = col;
        if (monthIdx === -1 && monthCount > 5) monthIdx = col;
      }

      if (teamIdx === -1) teamIdx = 4;
      if (dateStrIdx === -1) dateStrIdx = 7;
      if (monthIdx === -1) monthIdx = 8;
      if (dayOfWeekIdx === -1) dayOfWeekIdx = 13;
      if (timeIdx === -1) timeIdx = 14;
      if (typeIdx === -1) typeIdx = 15;
      if (resultCostIdx === -1) resultCostIdx = 17;
      if (costIdx === -1) costIdx = 22;
      
      if (centerIdx === -1) centerIdx = 3; 

      setErrorMsg('');

      const validData = [];
      for (let i = 1; i < parsedRows.length; i++) {
        const cols = parsedRows[i];
        if (cols.length <= costIdx) continue;
        
        const rawCenter = cols[centerIdx] || '';
        const center = normalizeCenterName(rawCenter);

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

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    rawData.forEach((d: any) => {
      const y = getYearFromMonth(d.month);
      if (y) yearSet.add(y);
    });
    return Array.from(yearSet).sort();
  }, [rawData]);

  const displayData = useMemo(() => {
    if (selectedYear === 'ALL') return rawData;
    return rawData.filter((d: any) => getYearFromMonth(d.month) === selectedYear);
  }, [rawData, selectedYear]);

  const calculated = useMemo(() => calculateCosts(displayData, settings), [displayData, settings]);

  const viewedData: any = useMemo(() => {
    if (activeViewSimId === 'current') return { name: '현재 시뮬레이션', settings, ...calculated };
    const saved = savedSims.find((s: any) => s.id === activeViewSimId);
    if (saved) {
      const reCalc = calculateCosts(displayData, saved.settings);
      return { name: saved.id, settings: saved.settings, ...reCalc };
    }
    return { name: '현재 시뮬레이션', settings, ...calculated };
  }, [activeViewSimId, savedSims, calculated, settings, displayData]);

  const VIEW_GYEONGIN_EXPENSE = currentExpense.gyeongin;             // 경인_현장
  const VIEW_GYEONGIN_SOAEK_EXPENSE = currentExpense.gyeonginSoaek; // 경인_소액
  const VIEW_JIBANG_EXPENSE = currentExpense.jibang;                 // 지방
  const VIEW_OTHERS_EXPENSE = currentExpense.others;                 // 그 외(경인_소액+지방)
  const VIEW_HYUN_EXPENSE = currentExpense.hyun;                     // 현장
  const VIEW_SOAEK_EXPENSE = currentExpense.soaek;                   // 소액
  const VIEW_OTHER_EXPENSE = currentExpense.total;                   // 기타지급 합계
  const VIEW_FIXED_COST = currentFinancials.fixedCost;               // 퍼시스 고정비
  const VIEW_LABOR_COST = currentFinancials.laborCost;               // 퍼시스 인건비
  const VIEW_NON_OP_PROFIT = currentFinancials.nonOpProfit;          // 영업외손익

  const getGlobalTP = (tr: number, tc: number) => {
    return tr - (tc + currentExpense.total);
  };
  
  const numMonths = calculated?.monthlyData?.length || 1;
  const oldTP = getGlobalTP(calculated.totalOldTR, calculated.totalOldTC);
  const currentTP = getGlobalTP(calculated.globalMetrics.totalTR, calculated.globalMetrics.totalTC);
  
  let bestSimId = '현재 시뮬레이션';
  let maxTP = currentTP;

  if (oldTP > maxTP) { bestSimId = '기존 (Old)'; maxTP = oldTP; }
  savedSims.forEach((sim: any) => {
    const simTP = getGlobalTP(sim.calculatedData.globalMetrics.totalTR, sim.calculatedData.globalMetrics.totalTC);
    if (simTP > maxTP) { bestSimId = sim.id; maxTP = simTP; }
  });

  const chartSeries: any[] = [];
  chartSeries.push({ name: '기존 (Old)', data: calculated.monthlyData.map((d: any) => ({ x: d.TC_old, y: d.TR_old, month: d.month })), color: '#9ca3af', isOptimal: bestSimId === '기존 (Old)' });
  savedSims.forEach((sim: any, idx: number) => {
    chartSeries.push({ name: sim.id, data: sim.calculatedData.monthlyData.map((d: any) => ({ x: d.TC_new, y: d.TR_new, month: d.month })), color: SIM_COLORS[idx % SIM_COLORS.length], isOptimal: bestSimId === sim.id });
  });
  chartSeries.push({ name: '현재 시뮬레이션', data: calculated.monthlyData.map((d: any) => ({ x: d.TC_new, y: d.TR_new, month: d.month })), color: '#3b82f6', isOptimal: bestSimId === '현재 시뮬레이션' });

  const updateSetting = (category, key, value) => {
    setActiveViewSimId('current'); 
    setSettings(prev => ({ 
      ...prev, 
      [category]: { 
        ...prev[category], 
        [key]: key === 'expenseVersion' ? String(value) : (parseFloat(value) || 0) 
      } 
    }));
    setAiReport('');
  };

  const handleLoadSimulation = (id) => {
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

  const handleDeleteSimulation = (id) => {
    setSavedSims(savedSims.filter(sim => sim.id !== id));
    if (activeViewSimId === id) setActiveViewSimId('current');
  };

  const handleGoalSeek = () => {
    if (displayData.length === 0) {
      showToast("⚠️ 데이터를 먼저 업로드해주세요.");
      return;
    }

    let YH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    let YSH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    let YSS = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    let LH = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };
    let LS = { day_H: 0, day_S: 0, night_H: 0, night_S: 0, week_H: 0, week_S: 0, oldTC: 0 };

    let TR_sum_H = 0;
    let TR_sum_S = 0;
    let TR_oldTR = 0;
    let totalResultCostSum = 0; 

    displayData.forEach(row => {
        const { center, isWeekend, timeHour, type, baseCost, resultCost } = row;
        const oldRules = getOldRates(isWeekend, timeHour, type);
        const TC_old = Math.floor(baseCost * oldRules.tcRate);
        const TR_old = Math.floor(baseCost * oldRules.trRate);

        const isDayTime = timeHour >= settings.time.dayStart && timeHour < settings.time.dayEnd;
        const isSmall = type === '소액';
        const actualResultCost = resultCost || 0;
        const baseForNew = isSmall ? Math.floor(baseCost / 1.28) : baseCost;

        let cat;
        if (center === '경인_현장') {
            cat = YH;
        } else if (center === '경인_소액') {
            cat = isSmall ? YSS : YSH;
        } else {
            cat = isSmall ? LS : LH;
        }

        cat.oldTC += TC_old;

        if (isWeekend) {
            if (isSmall) cat.week_S += baseForNew; else cat.week_H += baseCost;
        } else if (isDayTime) {
            if (isSmall) cat.day_S += baseForNew; else cat.day_H += baseCost;
        } else {
            if (isSmall) cat.night_S += baseForNew; else cat.night_H += baseCost;
        }

        TR_oldTR += TR_old;
        totalResultCostSum += actualResultCost;
        if (isSmall) {
            TR_sum_S += baseForNew;
        } else {
            TR_sum_H += baseCost;
        }
    });

    const evaluate = (p) => {
        const x = 1 + (p.baseIncrease / 100);
        const w = p.wSoaek;

        const getNewTC = (cat) => {
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
        const err_ysh = YSH.oldTC ? Math.pow((ysh_tc / YSH.oldTC) - 1.125, 2) : 0;
        const err_yss = YSS.oldTC ? Math.pow((yss_tc / YSS.oldTC) - 1.125, 2) : 0;
        const err_lh = LH.oldTC ? Math.pow((lh_tc / LH.oldTC) - 1.125, 2) : 0;
        const err_ls = LS.oldTC ? Math.pow((ls_tc / LS.oldTC) - 1.125, 2) : 0;
        
        const err_tr = TR_oldTR ? Math.pow((tr_val / TR_oldTR) - 0.975, 2) : 0;
        const err_c4 = totalResultCostSum ? Math.pow(billingRatio - 0.0535, 2) : 0;

        let loss = err_yh * 10 + err_ysh * 2 + err_yss * 2 + err_lh * 2 + err_ls * 2 + err_tr * 5 + err_c4 * 1000;

        let penalty = 0;

        const dynamicTargetExpense = currentExpense.total;

        if (tr_val * 0.9 < tc_total + dynamicTargetExpense) {
            const diff = (tc_total + dynamicTargetExpense) - (tr_val * 0.9);
            penalty += Math.pow(diff / 1e9, 2) * 5000;
        }

        const applyC2Penalty = (oldTC, newTC, minLimit, maxLimit) => {
            if (oldTC) {
                const r = newTC / oldTC;
                if (r < minLimit) penalty += Math.pow(minLimit - r, 2) * 10000;
                if (r > maxLimit) penalty += Math.pow(r - maxLimit, 2) * 10000;
            }
        };

        applyC2Penalty(YH.oldTC, yh_tc, 0.95, 1.10);
        applyC2Penalty(YSH.oldTC, ysh_tc, 1.05, 1.20);
        applyC2Penalty(YSS.oldTC, yss_tc, 1.05, 1.20);
        applyC2Penalty(LH.oldTC, lh_tc, 1.05, 1.20);
        applyC2Penalty(LS.oldTC, ls_tc, 1.05, 1.20);

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

    let bestParams = null;
    let currentLoss = Infinity;

    for(let restart = 0; restart < 5; restart++) {
      let currentParams = { 
        baseIncrease: restart === 0 ? settings.general.baseIncrease : (Math.random() * 20 - 5),
        wSoaek: restart === 0 ? settings.weight.soaek : (1.1 + Math.random() * 0.4),
        trHyun: restart === 0 ? settings.TR.hyunjangRate : (1.2 + Math.random() * 0.5),
        trSoaek: restart === 0 ? settings.TR.soaekRate : (1.3 + Math.random() * 0.5),
        tcNight: restart === 0 ? settings.TC.weekdayNight : (1.0 + Math.random() * 0.6),
        tcWeek: restart === 0 ? settings.TC.weekend : (1.1 + Math.random() * 0.6)
      };
      
      let step = 0.5;
      
      for (let i = 0; i < 25000; i++) {
        let cand = { ...currentParams };
        const keys = Object.keys(cand);
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

    if (bestParams) {
      setSettings(prev => ({
        ...prev,
        general: { ...prev.general, baseIncrease: parseFloat(bestParams.baseIncrease.toFixed(2)) },
        weight: { ...prev.weight, soaek: parseFloat(bestParams.wSoaek.toFixed(3)) },
        TR: { ...prev.TR, hyunjangRate: parseFloat(bestParams.trHyun.toFixed(3)), soaekRate: parseFloat(bestParams.trSoaek.toFixed(3)) },
        TC: { ...prev.TC, weekdayNight: parseFloat(bestParams.tcNight.toFixed(3)), weekend: parseFloat(bestParams.tcWeek.toFixed(3)) }
      }));
      
      setActiveViewSimId('current');
      const expText = `${selectedYear === 'ALL' ? '전체 연도' : `${selectedYear}년도`} 기타지급 ${(currentExpense.total / 100000000).toFixed(2)}억 원`;
      showToast(`🎯 정밀 100% 매칭 솔버 수렴 완료! (${expText} 기준)`);
    }
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

    const dynamicTargetExpense = VIEW_OTHER_EXPENSE;

    const cond1 = (totalTR * 0.9) >= (totalTC + dynamicTargetExpense);
    const cond1Gap = (totalTR * 0.9) - (totalTC + dynamicTargetExpense);
    
    const cond2_yh = (yangjiHyunNewTC >= yangjiHyunOldTC * 0.95) && (yangjiHyunNewTC <= yangjiHyunOldTC * 1.10);
    const cond2_ysh = (yangjiSoaekHyunNewTC >= yangjiSoaekHyunOldTC * 1.05) && (yangjiSoaekHyunNewTC <= yangjiSoaekHyunOldTC * 1.20);
    const cond2_yss = (yangjiSoaekSoaekNewTC >= yangjiSoaekSoaekOldTC * 1.05) && (yangjiSoaekSoaekNewTC <= yangjiSoaekSoaekOldTC * 1.20);
    const cond2_lh = (localHyunNewTC >= localHyunOldTC * 1.05) && (localHyunNewTC <= localHyunOldTC * 1.20);
    const cond2_ls = (localSoaekNewTC >= localSoaekOldTC * 1.05) && (localSoaekNewTC <= localSoaekOldTC * 1.20);
    
    const cond3 = (totalTR <= oldTR) && (totalTR >= oldTR * 0.95);

    // 경인_소액 전체 합계 & 차이
    const yangjiSoaekTotalOldTC = yangjiSoaekHyunOldTC + yangjiSoaekSoaekOldTC;
    const yangjiSoaekTotalNewTC = yangjiSoaekHyunNewTC + yangjiSoaekSoaekNewTC;
    const ysTotalRatio = yangjiSoaekTotalOldTC ? ((yangjiSoaekTotalNewTC / yangjiSoaekTotalOldTC) * 100) : 0;
    const ysTotalDiff = ysTotalRatio - 100;

    // 지방센터 전체 합계 & 차이
    const localTotalOldTC = localHyunOldTC + localSoaekOldTC;
    const localTotalNewTC = localHyunNewTC + localSoaekNewTC;
    const localTotalRatio = localTotalOldTC ? ((localTotalNewTC / localTotalOldTC) * 100) : 0;
    const localTotalDiff = localTotalRatio - 100;

    const billingRatio = totalResultCost ? (totalTR / totalResultCost) : 0;
    const cond4 = (billingRatio >= 0.05) && (billingRatio < 0.057);

    const c2Pass = cond2_yh && cond2_ysh && cond2_yss && cond2_lh && cond2_ls;

    return {
      c1: { pass: cond1, text: `TR*0.9 >= TC+${(dynamicTargetExpense/100000000).toFixed(2)}억 (격차: ₩${(cond1Gap/100000000).toFixed(2)}억)` },
      c2Pass,
      c2_yh: { pass: cond2_yh, text: `경인_현장 TC(New) 95%~110% (비율: ${yangjiHyunOldTC ? ((yangjiHyunNewTC / yangjiHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_ysh: { pass: cond2_ysh, text: `경인_소액-현장 TC(New) 105%~120% (비율: ${yangjiSoaekHyunOldTC ? ((yangjiSoaekHyunNewTC / yangjiSoaekHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_yss: { pass: cond2_yss, text: `경인_소액-소액 TC(New) 105%~120% (비율: ${yangjiSoaekSoaekOldTC ? ((yangjiSoaekSoaekNewTC / yangjiSoaekSoaekOldTC)*100).toFixed(1) : 0}%)` },
      c2_lh: { pass: cond2_lh, text: `지방센터-현장 TC(New) 105%~120% (비율: ${localHyunOldTC ? ((localHyunNewTC / localHyunOldTC)*100).toFixed(1) : 0}%)` },
      c2_ls: { pass: cond2_ls, text: `지방센터-소액 TC(New) 105%~120% (비율: ${localSoaekOldTC ? ((localSoaekNewTC / localSoaekOldTC)*100).toFixed(1) : 0}%)` },
      c2_ys_total: { ratio: ysTotalRatio.toFixed(1), diff: ysTotalDiff.toFixed(1) },
      c2_local_total: { ratio: localTotalRatio.toFixed(1), diff: localTotalDiff.toFixed(1) },
      c3: { pass: cond3, text: `TR(Old) >= TR(New) >= TR(Old)*0.95 (비율: ${oldTR ? ((totalTR / oldTR)*100).toFixed(1) : 0}%)` },
      c4: { pass: cond4, text: `결과금액 대비 청구율 5.0%~5.7% (비율: ${(billingRatio * 100).toFixed(2)}%)` }
    };
  };

  const lpStatus = checkLPConstraints();

  const formatDiffText = (diff) => {
    const isPos = diff > 0;
    const isNeg = diff < 0;
    const colorClass = isPos ? "text-red-500 font-semibold" : isNeg ? "text-blue-500 font-semibold" : "text-gray-400 font-semibold";
    const sign = isPos ? "+" : "";
    return <span className={colorClass}>{sign}{diff.toFixed(1)}%</span>;
  };

  const downloadCSV = () => {
    let csvContent = '\uFEFF'; 
    const vSettings = viewedData.settings;
    
    csvContent += `=== [${viewedData.name}] 설정값 ===\n`;
    csvContent += `기타 지급 버전,${vSettings.general.expenseVersion}년도\n`;
    csvContent += `정상시공비 인상률(%),${vSettings.general.baseIncrease}%\n`;
    csvContent += `주간 시간대 (시),${vSettings.time.dayStart} ~ ${vSettings.time.dayEnd}\n`;
    csvContent += `가중치,경인 현장: ${vSettings.weight.gyeonginHyunjang ?? 1.0} / 경인 소액/지방 현장: ${vSettings.weight.gyeonginSoaekJibangHyunjang ?? vSettings.weight.gyeonginSoaekHyunjang ?? 1.0} / 소액: ${vSettings.weight.soaek}\n`;
    csvContent += `청구 요율 (TR),현장 청구 요율: ${vSettings.TR.hyunjangRate} / 소액 청구 요율: ${vSettings.TR.soaekRate}\n`;
    csvContent += `지급 요율 (TC),평일 주간: ${vSettings.TC.weekdayDay} / 평일 야간: ${vSettings.TC.weekdayNight} / 주말: ${vSettings.TC.weekend}\n\n`;

    const getDiffCsv = (diff) => diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

    csvContent += `[1. 센터별 상세 결과]\n`;
    const headersCenter = ['센터(Center)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersCenter.join(',') + '\n';
    viewedData.centerData.forEach(c => {
      const trDiff = c.TR_old ? ((c.TR_new - c.TR_old) / c.TR_old) * 100 : 0;
      const tcDiff = c.TC_old ? ((c.TC_new - c.TC_old) / c.TC_old) * 100 : 0;
      csvContent += `${c.center},${Math.floor(c.baseCost)},${Math.floor(c.TR_old)},${Math.floor(c.TC_old)},${Math.floor(c.TR_new)},${Math.floor(c.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    csvContent += `\n[2. 권역시공팀별 상세 결과]\n`;
    const headersTeam = ['권역시공팀(Team)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersTeam.join(',') + '\n';
    viewedData.teamData.forEach(t => {
      const trDiff = t.TR_old ? ((t.TR_new - t.TR_old) / t.TR_old) * 100 : 0;
      const tcDiff = t.TC_old ? ((t.TC_new - t.TC_old) / t.TC_old) * 100 : 0;
      csvContent += `${t.team},${Math.floor(t.baseCost)},${Math.floor(t.TR_old)},${Math.floor(t.TC_old)},${Math.floor(t.TR_new)},${Math.floor(t.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    csvContent += `\n[3. 월별 상세 결과]\n`;
    const headersMonth = ['월(Month)', '기존 정상시공비', '기존 청구(TR)', '기존 지급(TC)', `${viewedData.name} 청구(TR)`, `${viewedData.name} 지급(TC)`, '청구 증감률(%)', '지급 증감률(%)'];
    csvContent += headersMonth.join(',') + '\n';
    viewedData.monthlyData.forEach(m => {
      const trDiff = m.TR_old ? ((m.TR_new - m.TR_old) / m.TR_old) * 100 : 0;
      const tcDiff = m.TC_old ? ((m.TC_new - m.TC_old) / m.TC_old) * 100 : 0;
      csvContent += `${m.month},${Math.floor(m.baseCost)},${Math.floor(m.TR_old)},${Math.floor(m.TC_old)},${Math.floor(m.TR_new)},${Math.floor(m.TC_new)},${getDiffCsv(trDiff)},${getDiffCsv(tcDiff)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${viewedData.name}_상세결과.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const vGlobal = viewedData?.globalMetrics || { totalTR: 0, totalTC: 0, gyeonginTR: 0, gyeonginTC: 0, gyeonginOldTR: 0, gyeonginOldTC: 0, othersTR: 0, othersTC: 0, othersOldTR: 0, othersOldTC: 0, totalResultCost: 0 };
  const vOldTR = viewedData?.totalOldTR || 0;
  const vOldTC = viewedData?.totalOldTC || 0;
  
  // 1. 기존 지표(Old) - 전체
  const vOldContributionMargin = vOldTR - (vOldTC + VIEW_OTHER_EXPENSE);
  const vOldContributionMarginRate = vOldTR ? (vOldContributionMargin / vOldTR) * 100 : 0;
  const vOldOperatingProfit = vOldContributionMargin - VIEW_FIXED_COST - VIEW_LABOR_COST;
  const vOldOperatingProfitRate = vOldTR ? (vOldOperatingProfit / vOldTR) * 100 : 0;
  const vOldNetProfit = vOldOperatingProfit + VIEW_LABOR_COST + VIEW_NON_OP_PROFIT;
  const vOldNetProfitRate = vOldTR ? (vOldNetProfit / vOldTR) * 100 : 0;

  // 2. 신규 지표(New) - 전체
  const vNewContributionMargin = vGlobal.totalTR - (vGlobal.totalTC + VIEW_OTHER_EXPENSE);
  const vNewContributionMarginRate = vGlobal.totalTR ? (vNewContributionMargin / vGlobal.totalTR) * 100 : 0;
  const vNewOperatingProfit = vNewContributionMargin - VIEW_FIXED_COST - VIEW_LABOR_COST;
  const vNewOperatingProfitRate = vGlobal.totalTR ? (vNewOperatingProfit / vGlobal.totalTR) * 100 : 0;
  const vNewNetProfit = vNewOperatingProfit + VIEW_LABOR_COST + VIEW_NON_OP_PROFIT;
  const vNewNetProfitRate = vGlobal.totalTR ? (vNewNetProfit / vGlobal.totalTR) * 100 : 0;

  // 3. 분할 지표 (New) - 경인_현장 / 경인_소액 / 지방
  const gyeonginMargin = (vGlobal.gyeonginTR || 0) - ((vGlobal.gyeonginTC || 0) + VIEW_GYEONGIN_EXPENSE);
  const gyeonginMarginRate = vGlobal.gyeonginTR ? (gyeonginMargin / vGlobal.gyeonginTR) * 100 : 0;

  const gyeonginSoaekMargin = (vGlobal.gyeonginSoaekTR || 0) - ((vGlobal.gyeonginSoaekTC || 0) + VIEW_GYEONGIN_SOAEK_EXPENSE);
  const gyeonginSoaekMarginRate = vGlobal.gyeonginSoaekTR ? (gyeonginSoaekMargin / vGlobal.gyeonginSoaekTR) * 100 : 0;

  const jibangMargin = (vGlobal.jibangTR || 0) - ((vGlobal.jibangTC || 0) + VIEW_JIBANG_EXPENSE);
  const jibangMarginRate = vGlobal.jibangTR ? (jibangMargin / vGlobal.jibangTR) * 100 : 0;

  const othersMargin = (vGlobal.othersTR || 0) - ((vGlobal.othersTC || 0) + VIEW_OTHERS_EXPENSE);
  const othersMarginRate = vGlobal.othersTR ? (othersMargin / vGlobal.othersTR) * 100 : 0;

  // 4. 분할 지표 (Old) - 경인_현장 / 경인_소액 / 지방
  const oldGyeonginMargin = (vGlobal.gyeonginOldTR || 0) - ((vGlobal.gyeonginOldTC || 0) + VIEW_GYEONGIN_EXPENSE);
  const oldGyeonginMarginRate = vGlobal.gyeonginOldTR ? (oldGyeonginMargin / vGlobal.gyeonginOldTR) * 100 : 0;

  const oldGyeonginSoaekMargin = (vGlobal.gyeonginSoaekOldTR || 0) - ((vGlobal.gyeonginSoaekOldTC || 0) + VIEW_GYEONGIN_SOAEK_EXPENSE);
  const oldGyeonginSoaekMarginRate = vGlobal.gyeonginSoaekOldTR ? (oldGyeonginSoaekMargin / vGlobal.gyeonginSoaekOldTR) * 100 : 0;

  const oldJibangMargin = (vGlobal.jibangOldTR || 0) - ((vGlobal.jibangOldTC || 0) + VIEW_JIBANG_EXPENSE);
  const oldJibangMarginRate = vGlobal.jibangOldTR ? (oldJibangMargin / vGlobal.jibangOldTR) * 100 : 0;

  const oldOthersMargin = (vGlobal.othersOldTR || 0) - ((vGlobal.othersOldTC || 0) + VIEW_OTHERS_EXPENSE);
  const oldOthersMarginRate = vGlobal.othersOldTR ? (oldOthersMargin / vGlobal.othersOldTR) * 100 : 0;

  // 5. 기타지급 (사용자 설정 고정값 반영: 현장 932,577,000원 / 소액 782,703,876원)
  const hyunExpense = VIEW_HYUN_EXPENSE;   // 932,577,000원
  const soaekExpense = VIEW_SOAEK_EXPENSE; // 782,703,876원

  // 6. 현장 vs 소액 공헌이익 (기타지급 반영!)
  const hyunOldContrib = (vGlobal.hyunOldTR || 0) - (vGlobal.hyunOldTC || 0) - hyunExpense;
  const hyunOldContribRate = vGlobal.hyunOldTR ? (hyunOldContrib / vGlobal.hyunOldTR) * 100 : 0;
  const hyunNewContrib = (vGlobal.hyunNewTR || 0) - (vGlobal.hyunNewTC || 0) - hyunExpense;
  const hyunNewContribRate = vGlobal.hyunNewTR ? (hyunNewContrib / vGlobal.hyunNewTR) * 100 : 0;

  const soaekOldContrib = (vGlobal.soaekOldTR || 0) - (vGlobal.soaekOldTC || 0) - soaekExpense;
  const soaekOldContribRate = vGlobal.soaekOldTR ? (soaekOldContrib / vGlobal.soaekOldTR) * 100 : 0;
  const soaekNewContrib = (vGlobal.soaekNewTR || 0) - (vGlobal.soaekNewTC || 0) - soaekExpense;
  const soaekNewContribRate = vGlobal.soaekNewTR ? (soaekNewContrib / vGlobal.soaekNewTR) * 100 : 0;

  // 7. 현장 vs 소액 영업이익 & 채산이익 (TR 비중에 따라 고정비/인건비/영업외손익 배부)
  const hyunOldTrRatio = vOldTR ? ((vGlobal.hyunOldTR || 0) / vOldTR) : 0;
  const soaekOldTrRatio = vOldTR ? ((vGlobal.soaekOldTR || 0) / vOldTR) : 0;

  const hyunNewTrRatio = vGlobal.totalTR ? ((vGlobal.hyunNewTR || 0) / vGlobal.totalTR) : 0;
  const soaekNewTrRatio = vGlobal.totalTR ? ((vGlobal.soaekNewTR || 0) / vGlobal.totalTR) : 0;

  // 현장 영업이익 & 채산이익
  const hyunOldOpProfit = hyunOldContrib - (VIEW_FIXED_COST + VIEW_LABOR_COST) * hyunOldTrRatio;
  const hyunOldOpProfitRate = vGlobal.hyunOldTR ? (hyunOldOpProfit / vGlobal.hyunOldTR) * 100 : 0;
  const hyunOldNetProfit = hyunOldOpProfit + (VIEW_LABOR_COST + VIEW_NON_OP_PROFIT) * hyunOldTrRatio;
  const hyunOldNetProfitRate = vGlobal.hyunOldTR ? (hyunOldNetProfit / vGlobal.hyunOldTR) * 100 : 0;

  const hyunNewOpProfit = hyunNewContrib - (VIEW_FIXED_COST + VIEW_LABOR_COST) * hyunNewTrRatio;
  const hyunNewOpProfitRate = vGlobal.hyunNewTR ? (hyunNewOpProfit / vGlobal.hyunNewTR) * 100 : 0;
  const hyunNewNetProfit = hyunNewOpProfit + (VIEW_LABOR_COST + VIEW_NON_OP_PROFIT) * hyunNewTrRatio;
  const hyunNewNetProfitRate = vGlobal.hyunNewTR ? (hyunNewNetProfit / vGlobal.hyunNewTR) * 100 : 0;

  // 소액 영업이익 & 채산이익
  const soaekOldOpProfit = soaekOldContrib - (VIEW_FIXED_COST + VIEW_LABOR_COST) * soaekOldTrRatio;
  const soaekOldOpProfitRate = vGlobal.soaekOldTR ? (soaekOldOpProfit / vGlobal.soaekOldTR) * 100 : 0;
  const soaekOldNetProfit = soaekOldOpProfit + (VIEW_LABOR_COST + VIEW_NON_OP_PROFIT) * soaekOldTrRatio;
  const soaekOldNetProfitRate = vGlobal.soaekOldTR ? (soaekOldNetProfit / vGlobal.soaekOldTR) * 100 : 0;

  const soaekNewOpProfit = soaekNewContrib - (VIEW_FIXED_COST + VIEW_LABOR_COST) * soaekNewTrRatio;
  const soaekNewOpProfitRate = vGlobal.soaekNewTR ? (soaekNewOpProfit / vGlobal.soaekNewTR) * 100 : 0;
  const soaekNewNetProfit = soaekNewOpProfit + (VIEW_LABOR_COST + VIEW_NON_OP_PROFIT) * soaekNewTrRatio;
  const soaekNewNetProfitRate = vGlobal.soaekNewTR ? (soaekNewNetProfit / vGlobal.soaekNewTR) * 100 : 0;

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Toast Notification Banner */}
        {toastMsg && (
          <div className="bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center transition-all animate-fade-in">
            <span className="font-semibold text-sm">{toastMsg}</span>
            <button onClick={() => setToastMsg('')} className="text-white hover:text-gray-200 font-bold ml-4 text-xs">✕</button>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-blue-600">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">월별 시공비용 & LP 최적화 시뮬레이터</h1>
            <p className="text-sm text-gray-500 mt-1">
              {selectedYear === 'ALL' ? `전체 연도 기타지급 고정 비용 합계(${(currentExpense.total / 100000000).toFixed(2)}억 원)` : `${selectedYear}년도 기타지급 고정 비용(${(currentExpense.total / 100000000).toFixed(2)}억 원)`} 기준 및 현장/소액 다차원 손익 분석 적용
            </p>
          </div>
          <div className="flex flex-col items-end">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
          </div>
        </div>

        {/* 연도별 분리 조회 탭 */}
        {availableYears.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 border border-gray-100">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-700 mr-2 flex items-center gap-1.5">
                📅 연도별 분리 조회:
              </span>
              <button
                onClick={() => setSelectedYear('ALL')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  selectedYear === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체 연도 ({rawData.length.toLocaleString()}건)
              </button>
              {availableYears.map(year => {
                const count = rawData.filter((d: any) => getYearFromMonth(d.month) === year).length;
                return (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                      selectedYear === year
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {year}년 ({count.toLocaleString()}건)
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
              현재 분석 적용: <span className="font-bold text-blue-600">{selectedYear === 'ALL' ? '전체 데이터' : `${selectedYear}년도 데이터`}</span> (<span className="text-gray-800 font-semibold">{displayData.length.toLocaleString()}건</span>)
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col h-[500px]">
              <h2 className="text-lg font-bold text-gray-800 mb-2 flex justify-between items-center">
                월별 총 청구(TR) vs 총 지급(TC) 추이 산점도
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">* 별표(★)는 TP가 가장 높은 최적의 모델입니다. <b>범례 클릭으로 토글</b>.</span>
              </h2>
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                    <XAxis type="number" dataKey="x" name="시공비 지급(TC)" tickFormatter={(val) => `₩${(val/100000000).toFixed(1)}억`} domain={['auto', 'auto']} />
                    <YAxis type="number" dataKey="y" name="총 청구(TR)" tickFormatter={(val) => `₩${(val/100000000).toFixed(1)}억`} domain={['auto', 'auto']} />
                    <Tooltip content={(props) => <CustomTooltipComponent {...props} numMonths={numMonths} otherExpense={VIEW_OTHER_EXPENSE} />} cursor={{ strokeDasharray: '3 3' }} />
                    <Legend onClick={(e) => setHiddenSeries(prev => prev.includes(e.value) ? prev.filter(s => s !== e.value) : [...prev, e.value])} formatter={(val) => hiddenSeries.includes(val) ? `${val} (숨김)` : val} />
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
              )}
            </div>

            {/* LP Constraints & AI Panel */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-sm text-white">
              <div className="flex justify-between items-center mb-4">
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
                  <div className="font-bold mb-1">{lpStatus.c1.pass ? '✅' : '❌'} 조건 1. 목표 공헌이익 확보</div>
                  <p className="text-sm text-gray-300">{lpStatus.c1.text}</p>
                </div>
                <div className={`p-4 rounded border ${lpStatus.c2Pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c2Pass ? '✅' : '❌'} 조건 2. 센터별 지급 방어선</div>
                  <p className="text-xs text-gray-300 mb-1">{lpStatus.c2_yh.text}</p>

                  <div className="pt-1.5 border-t border-gray-700/40 space-y-0.5">
                    <p className="text-xs font-bold text-amber-300">
                      📊 경인_소액 전체: 지급비율 {lpStatus.c2_ys_total.ratio}% (기존 대비 {parseFloat(lpStatus.c2_ys_total.diff) >= 0 ? `+${lpStatus.c2_ys_total.diff}%` : `${lpStatus.c2_ys_total.diff}%`})
                    </p>
                    <p className="text-xs text-gray-300 pl-3">└ {lpStatus.c2_ysh.text}</p>
                    <p className="text-xs text-gray-300 pl-3">└ {lpStatus.c2_yss.text}</p>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-gray-700/40 space-y-0.5">
                    <p className="text-xs font-bold text-amber-300">
                      📊 지방센터 전체: 지급비율 {lpStatus.c2_local_total.ratio}% (기존 대비 {parseFloat(lpStatus.c2_local_total.diff) >= 0 ? `+${lpStatus.c2_local_total.diff}%` : `${lpStatus.c2_local_total.diff}%`})
                    </p>
                    <p className="text-xs text-gray-300 pl-3">└ {lpStatus.c2_lh.text}</p>
                    <p className="text-xs text-gray-300 pl-3">└ {lpStatus.c2_ls.text}</p>
                  </div>
                </div>
                <div className={`p-4 rounded border ${lpStatus.c3.pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c3.pass ? '✅' : '❌'} 조건 3. 대고객사 청구액 통제</div>
                  <p className="text-sm text-gray-300">{lpStatus.c3.text}</p>
                </div>
                <div className={`p-4 rounded border ${lpStatus.c4.pass ? 'border-green-500 bg-green-900/30' : 'border-red-500 bg-red-900/30'}`}>
                  <div className="font-bold mb-1">{lpStatus.c4.pass ? '✅' : '❌'} 조건 4. 결과금액 대비 청구율 (5.0%~5.7%)</div>
                  <p className="text-sm text-gray-300">{lpStatus.c4.text}</p>
                </div>
              </div>

              {(aiReport || aiError) && (
                <div className="mt-4 p-5 rounded-lg border border-purple-400 bg-purple-900/20">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-purple-300 font-bold flex items-center gap-2">✨ Gemini AI: 최적 파라미터 제안</h3>
                    {recommendedSettings && <button onClick={applyRecommendedSettings} className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-1 px-3 rounded shadow animate-pulse">🎯 추천값 일괄 적용</button>}
                  </div>
                  {aiError ? <p className="text-red-400 text-sm">{aiError}</p> : <div className="text-sm text-gray-200 whitespace-pre-wrap">{aiReport}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls Sidebar */}
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
                  <input type="number" step="0.5" value={settings.time.dayStart} onChange={e => updateSetting('time', 'dayStart', e.target.value)} className="w-14 p-1 border text-center text-xs"/> ~ 
                  <input type="number" step="0.5" value={settings.time.dayEnd} onChange={e => updateSetting('time', 'dayEnd', e.target.value)} className="w-14 p-1 border text-center text-xs"/>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <h3 className="font-bold text-gray-800 text-sm flex justify-between items-center">
                  지급 가중치 (TC)
                  <span className="text-[10px] text-gray-500 font-normal">*청구(TR) 현장은 1.0 고정</span>
                </h3>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                  <label className="font-bold text-gray-700">경인 현장 가중치</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={settings.weight.gyeonginHyunjang ?? 1.0} 
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setSettings(prev => ({
                        ...prev,
                        weight: { ...prev.weight, gyeonginHyunjang: val, hyunjang: val }
                      }));
                    }} 
                    className="w-16 p-1 border rounded text-right font-bold text-gray-800"
                  />
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                  <label className="font-bold text-gray-700">경인 소액/지방 현장 가중치</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={settings.weight.gyeonginSoaekJibangHyunjang ?? settings.weight.gyeonginSoaekHyunjang ?? 1.0} 
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setSettings(prev => ({
                        ...prev,
                        weight: { 
                          ...prev.weight, 
                          gyeonginSoaekJibangHyunjang: val,
                          gyeonginSoaekHyunjang: val,
                          jibangHyunjang: val 
                        }
                      }));
                    }} 
                    className="w-16 p-1 border rounded text-right font-bold text-gray-800"
                  />
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                  <label className="font-bold text-gray-700">소액 가중치</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={settings.weight.soaek} 
                    onChange={e => updateSetting('weight', 'soaek', e.target.value)} 
                    className="w-16 p-1 border rounded text-right font-bold text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h3 className="font-bold text-blue-700 text-sm mb-3">청구 요율 (분할)</h3>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-indigo-800">현장 청구 요율</label>
                <input type="number" step="0.01" value={settings.TR.hyunjangRate} onChange={e => updateSetting('TR', 'hyunjangRate', e.target.value)} className="w-16 p-1 border rounded border-indigo-500 text-right font-bold text-indigo-800"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-indigo-800">소액 청구 요율</label>
                <input type="number" step="0.01" value={settings.TR.soaekRate} onChange={e => updateSetting('TR', 'soaekRate', e.target.value)} className="w-16 p-1 border rounded border-indigo-500 text-right font-bold text-indigo-800"/>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h3 className="font-bold text-red-700 text-sm mb-3">지급 요율</h3>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-400">평일 주간 <span className="text-xs">(고정)</span></label>
                <input type="number" value={1.00} disabled className="w-16 p-1 border rounded text-right bg-gray-100 text-gray-400 cursor-not-allowed"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-red-800">평일 야간 (기본 1.0)</label>
                <input type="number" step="0.01" value={settings.TC.weekdayNight} onChange={e => updateSetting('TC', 'weekdayNight', e.target.value)} className="w-16 p-1 border rounded text-right font-bold"/>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="text-gray-600 font-semibold text-red-800">주말 (기본 1.0)</label>
                <input type="number" step="0.01" value={settings.TC.weekend} onChange={e => updateSetting('TC', 'weekend', e.target.value)} className="w-16 p-1 border rounded text-right font-bold"/>
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

        {/* Bottom Section: Summary Cards & Detailed Tables */}
        <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto mt-6 border-t-4 border-gray-300">
           
           <div className="flex items-center justify-between mb-4 border-b pb-4">
             <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 flex-wrap">
               📊 시뮬레이션 결과 및 요약 <span className="text-blue-600 text-lg">[{viewedData.name}]</span>
               <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                 {selectedYear === 'ALL' ? '전체 연도 데이터 집계' : `${selectedYear}년도 데이터 집계`} ({displayData.length.toLocaleString()}건)
               </span>
             </h2>
             <button onClick={downloadCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-lg shadow transition">
               엑셀 다운로드 (CSV)
             </button>
           </div>

           {/* 결과 요약 패널 (Grid 5칸) */}
           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 border-b pb-6">
             {/* 1. 기존 지표 (Old) 전체 */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 col-span-1">
                <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">기존 지표 (Old) - 합계</h3>
                <p className="text-sm text-gray-600 flex justify-between"><span>전체 청구:</span> <span>₩{Math.floor(vOldTR).toLocaleString()}</span></p>
                <p className="text-sm text-gray-600 flex justify-between"><span>시공비 지급:</span> <span>₩{Math.floor(vOldTC).toLocaleString()}</span></p>
                <p className="text-sm text-gray-600 flex justify-between"><span>기타 지급:</span> <span>₩{VIEW_OTHER_EXPENSE.toLocaleString()}</span></p>
                <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                  <p className="text-sm text-gray-800 font-bold flex justify-between">
                    <span>전체 공헌이익:</span> 
                    <span>₩{Math.floor(vOldContributionMargin).toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-gray-800 font-bold flex justify-between">
                    <span>전체 공헌이익율:</span> 
                    <span>{vOldContributionMarginRate.toFixed(1)}%</span>
                  </p>
                  <p className="text-[11px] text-indigo-900 font-bold flex justify-between border-t border-gray-200 pt-1">
                    <span>영업이익:</span> 
                    <span>₩{Math.floor(vOldOperatingProfit).toLocaleString()}</span>
                  </p>
                  <p className="text-[11px] text-indigo-900 font-bold flex justify-between">
                    <span>영업이익율:</span> 
                    <span>{vOldOperatingProfitRate.toFixed(1)}%</span>
                  </p>
                  <p className="text-[11px] text-purple-900 font-bold flex justify-between border-t border-gray-200 pt-1">
                    <span>채산이익:</span> 
                    <span>₩{Math.floor(vOldNetProfit).toLocaleString()}</span>
                  </p>
                  <p className="text-[11px] text-purple-900 font-bold flex justify-between">
                    <span>채산이익율:</span> 
                    <span>{vOldNetProfitRate.toFixed(1)}%</span>
                  </p>
                </div>
              </div>

              {/* 2. 기존 지표 (Old) 분할 세부 요약 */}
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 col-span-1 space-y-2">
                <h3 className="font-bold text-gray-800 border-b border-gray-300 pb-1.5 text-xs flex justify-between items-center">
                  <span>Old 세부 지표 분할 요약</span>
                  <span className="text-[10px] text-gray-500 font-normal">3분할</span>
                </h3>
                {/* 경인_현장 */}
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-bold text-gray-900 text-[11px]">🌐 경인_현장 (기타 {(VIEW_GYEONGIN_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-gray-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.gyeonginOldTR).toLocaleString()}</span></p> 
                  <p className="text-gray-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.gyeonginOldTC).toLocaleString()}</span></p>
                  <p className="text-gray-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_GYEONGIN_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-gray-900 font-bold flex justify-between border-t border-gray-300 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(oldGyeonginMargin).toLocaleString()} ({oldGyeonginMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
                {/* 경인_소액 */}
                <div className="space-y-0.5 text-[11px] border-t border-gray-300 pt-1.5">
                  <p className="font-bold text-gray-900 text-[11px]">📦 경인_소액 (기타 {(VIEW_GYEONGIN_SOAEK_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-gray-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.gyeonginSoaekOldTR || 0).toLocaleString()}</span></p>
                  <p className="text-gray-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.gyeonginSoaekOldTC || 0).toLocaleString()}</span></p>
                  <p className="text-gray-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_GYEONGIN_SOAEK_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-gray-900 font-bold flex justify-between border-t border-gray-300 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(oldGyeonginSoaekMargin).toLocaleString()} ({oldGyeonginSoaekMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
                {/* 지방 센터 */}
                <div className="space-y-0.5 text-[11px] border-t border-gray-300 pt-1.5">
                  <p className="font-bold text-gray-900 text-[11px]">🚚 지방센터 (기타 {(VIEW_JIBANG_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-gray-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.jibangOldTR || 0).toLocaleString()}</span></p>
                  <p className="text-gray-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.jibangOldTC || 0).toLocaleString()}</span></p>
                  <p className="text-gray-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_JIBANG_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-gray-900 font-bold flex justify-between border-t border-gray-300 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(oldJibangMargin).toLocaleString()} ({oldJibangMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>
             
             {/* 3. 시뮬레이션 지표 (New) 전체 합계 */}
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 col-span-1">
               <h3 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-2">시뮬레이션 지표 (New) - 합계</h3>
               <p className="text-sm text-blue-700 flex justify-between"><span>전체 청구:</span> <span>₩{Math.floor(vGlobal.totalTR).toLocaleString()}</span></p>
               <p className="text-sm text-blue-700 flex justify-between"><span>시공비 지급:</span> <span>₩{Math.floor(vGlobal.totalTC).toLocaleString()}</span></p>
               <p className="text-sm text-blue-700 flex justify-between"><span>기타 지급:</span> <span>₩{VIEW_OTHER_EXPENSE.toLocaleString()}</span></p>
               <div className="mt-2 pt-2 border-t border-blue-200 space-y-1">
                 <p className="text-sm text-blue-900 font-bold flex justify-between">
                   <span>전체 공헌이익:</span> 
                   <span>₩{Math.floor(vNewContributionMargin).toLocaleString()}</span>
                 </p>
                 <p className="text-sm text-blue-900 font-bold flex justify-between">
                   <span>전체 공헌이익율:</span> 
                   <span>{vNewContributionMarginRate.toFixed(1)}%</span>
                 </p>
                 <p className="text-[11px] text-indigo-900 font-bold flex justify-between border-t border-blue-200 pt-1">
                   <span>영업이익:</span> 
                   <span>₩{Math.floor(vNewOperatingProfit).toLocaleString()}</span>
                 </p>
                 <p className="text-[11px] text-indigo-900 font-bold flex justify-between">
                   <span>영업이익율:</span> 
                   <span>{vNewOperatingProfitRate.toFixed(1)}%</span>
                 </p>
                 <p className="text-[11px] text-purple-900 font-bold flex justify-between border-t border-blue-200 pt-1">
                   <span>채산이익:</span> 
                   <span>₩{Math.floor(vNewNetProfit).toLocaleString()}</span>
                 </p>
                 <p className="text-[11px] text-purple-900 font-bold flex justify-between">
                   <span>채산이익율:</span> 
                   <span>{vNewNetProfitRate.toFixed(1)}%</span>
                 </p>
               </div>
             </div>

             {/* 4. 시뮬레이션 지표 (New) 분할 세부 요약 */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 col-span-1 space-y-2">
                <h3 className="font-bold text-purple-800 border-b border-purple-200 pb-1.5 text-xs flex justify-between items-center">
                  <span>New 세부 지표 분할 요약</span>
                  <span className="text-[10px] text-purple-600 font-normal">3분할</span>
                </h3>
                {/* 경인_현장 */}
                <div className="space-y-0.5 text-[11px]">
                  <p className="font-bold text-purple-900 text-[11px]">🌐 경인_현장 (기타 {(VIEW_GYEONGIN_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-purple-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.gyeonginTR).toLocaleString()}</span></p> 
                  <p className="text-purple-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.gyeonginTC).toLocaleString()}</span></p>
                  <p className="text-purple-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_GYEONGIN_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-purple-900 font-bold flex justify-between border-t border-purple-200 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(gyeonginMargin).toLocaleString()} ({gyeonginMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
                {/* 경인_소액 */}
                <div className="space-y-0.5 text-[11px] border-t border-purple-200 pt-1.5">
                  <p className="font-bold text-purple-900 text-[11px]">📦 경인_소액 (기타 {(VIEW_GYEONGIN_SOAEK_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-purple-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.gyeonginSoaekTR || 0).toLocaleString()}</span></p>
                  <p className="text-purple-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.gyeonginSoaekTC || 0).toLocaleString()}</span></p>
                  <p className="text-purple-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_GYEONGIN_SOAEK_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-purple-900 font-bold flex justify-between border-t border-purple-200 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(gyeonginSoaekMargin).toLocaleString()} ({gyeonginSoaekMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
                {/* 지방 센터 */}
                <div className="space-y-0.5 text-[11px] border-t border-purple-200 pt-1.5">
                  <p className="font-bold text-purple-900 text-[11px]">🚚 지방센터 (기타 {(VIEW_JIBANG_EXPENSE/100000000).toFixed(2)}억)</p>
                  <p className="text-purple-700 flex justify-between"><span>청구금액:</span> <span>₩{Math.floor(vGlobal.jibangTR || 0).toLocaleString()}</span></p>
                  <p className="text-purple-700 flex justify-between"><span>지급금액:</span> <span>₩{Math.floor(vGlobal.jibangTC || 0).toLocaleString()}</span></p>
                  <p className="text-purple-700 flex justify-between"><span>기타지급:</span> <span>₩{VIEW_JIBANG_EXPENSE.toLocaleString()}</span></p>
                  <p className="text-purple-900 font-bold flex justify-between border-t border-purple-200 pt-0.5">
                    <span>공헌이익:</span> 
                    <span>₩{Math.floor(jibangMargin).toLocaleString()} ({jibangMarginRate.toFixed(1)}%)</span>
                  </p>
                </div>
              </div>

              {/* 5. 시공 비율 요약 */}
             <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 col-span-1">
               <h3 className="font-bold text-orange-800 mb-2 border-b border-orange-200 pb-2">시공 비율 요약</h3>
               <div className="space-y-1 text-xs">
                 <p className="text-orange-700 font-semibold mb-1">건수 비율:</p>
                 <p className="text-orange-600 flex justify-between pl-2"><span>평일 주간 / 야간:</span> <span>{viewedData.ratios.weekdayDay}% / {viewedData.ratios.weekdayNight}%</span></p>
                 <p className="text-orange-600 flex justify-between pl-2"><span>주말/공휴일:</span> <span>{viewedData.ratios.weekend}%</span></p>
                 
                 <p className="text-teal-700 font-semibold mt-2 mb-1">금액 비율:</p>
                 <p className="text-teal-600 flex justify-between pl-2"><span>평일 주간 / 야간:</span> <span>{viewedData.amountRatios.weekdayDay}% / {viewedData.amountRatios.weekdayNight}%</span></p>
                 <p className="text-teal-600 flex justify-between pl-2"><span>주말/공휴일:</span> <span>{viewedData.amountRatios.weekend}%</span></p>
               </div>
             </div>
            </div>

            {/* 현장 vs 소액 공헌이익/영업이익/채산이익 비교 카드 패널 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-slate-100 p-4 rounded-xl border border-slate-300">
              {/* 🏗️ 현장 부문 전체 재무 비교 */}
              <div className="bg-white p-4 rounded-lg border-l-4 border-blue-600 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800 flex items-center gap-1.5 text-base">
                    🏗️ 현장 부문 재무 비교 <span className="text-xs font-normal text-gray-500">(전체 현장건 합계)</span>
                  </h3>
                  <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">현장 시공</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-gray-50 p-2.5 rounded border text-xs space-y-1">
                    <p className="font-bold text-gray-700 text-sm border-b pb-1">기존 (Old)</p>
                    <p className="flex justify-between text-gray-600"><span>청구(TR):</span> <span>₩{Math.floor(vGlobal.hyunOldTR || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-gray-600"><span>시공지급(TC):</span> <span>₩{Math.floor(vGlobal.hyunOldTC || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-gray-600"><span>기타지급:</span> <span>₩{Math.floor(hyunExpense).toLocaleString()}</span></p>
                    <p className="flex justify-between font-bold text-gray-800 border-t pt-1">
                      <span>공헌이익:</span> <span>₩{Math.floor(hyunOldContrib).toLocaleString()} ({hyunOldContribRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-semibold text-indigo-800">
                      <span>영업이익:</span> <span>₩{Math.floor(hyunOldOpProfit).toLocaleString()} ({hyunOldOpProfitRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-bold text-purple-800 border-t pt-0.5">
                      <span>채산이익:</span> <span>₩{Math.floor(hyunOldNetProfit).toLocaleString()} ({hyunOldNetProfitRate.toFixed(1)}%)</span>
                    </p>
                  </div>
                  <div className="bg-blue-50/70 p-2.5 rounded border border-blue-200 text-xs space-y-1">
                    <p className="font-bold text-blue-900 text-sm border-b border-blue-200 pb-1 flex justify-between">
                      <span>시뮬 (New)</span>
                      <span className="text-[11px]">
                        {formatDiffText(hyunOldNetProfit ? ((hyunNewNetProfit - hyunOldNetProfit) / Math.abs(hyunOldNetProfit)) * 100 : 0)}
                      </span>
                    </p>
                    <p className="flex justify-between text-blue-800"><span>청구(TR):</span> <span>₩{Math.floor(vGlobal.hyunNewTR || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-blue-800"><span>시공지급(TC):</span> <span>₩{Math.floor(vGlobal.hyunNewTC || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-blue-800"><span>기타지급:</span> <span>₩{Math.floor(hyunExpense).toLocaleString()}</span></p>
                    <p className="flex justify-between font-bold text-blue-900 border-t border-blue-200 pt-1">
                      <span>공헌이익:</span> <span>₩{Math.floor(hyunNewContrib).toLocaleString()} ({hyunNewContribRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-semibold text-indigo-900">
                      <span>영업이익:</span> <span>₩{Math.floor(hyunNewOpProfit).toLocaleString()} ({hyunNewOpProfitRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-bold text-purple-900 border-t border-blue-200 pt-0.5">
                      <span>채산이익:</span> <span>₩{Math.floor(hyunNewNetProfit).toLocaleString()} ({hyunNewNetProfitRate.toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 📦 소액 부문 전체 재무 비교 */}
              <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow-sm space-y-2">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800 flex items-center gap-1.5 text-base">
                    📦 소액 부문 재무 비교 <span className="text-xs font-normal text-gray-500">(전체 소액건 합계)</span>
                  </h3>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">소액 시공</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-gray-50 p-2.5 rounded border text-xs space-y-1">
                    <p className="font-bold text-gray-700 text-sm border-b pb-1">기존 (Old)</p>
                    <p className="flex justify-between text-gray-600"><span>청구(TR):</span> <span>₩{Math.floor(vGlobal.soaekOldTR || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-gray-600"><span>시공지급(TC):</span> <span>₩{Math.floor(vGlobal.soaekOldTC || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-gray-600"><span>기타지급:</span> <span>₩{Math.floor(soaekExpense).toLocaleString()}</span></p>
                    <p className="flex justify-between font-bold text-gray-800 border-t pt-1">
                      <span>공헌이익:</span> <span>₩{Math.floor(soaekOldContrib).toLocaleString()} ({soaekOldContribRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-semibold text-indigo-800">
                      <span>영업이익:</span> <span>₩{Math.floor(soaekOldOpProfit).toLocaleString()} ({soaekOldOpProfitRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-bold text-purple-800 border-t pt-0.5">
                      <span>채산이익:</span> <span>₩{Math.floor(soaekOldNetProfit).toLocaleString()} ({soaekOldNetProfitRate.toFixed(1)}%)</span>
                    </p>
                  </div>
                  <div className="bg-amber-50/70 p-2.5 rounded border border-amber-200 text-xs space-y-1">
                    <p className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-1 flex justify-between">
                      <span>시뮬 (New)</span>
                      <span className="text-[11px]">
                        {formatDiffText(soaekOldNetProfit ? ((soaekNewNetProfit - soaekOldNetProfit) / Math.abs(soaekOldNetProfit)) * 100 : 0)}
                      </span>
                    </p>
                    <p className="flex justify-between text-amber-800"><span>청구(TR):</span> <span>₩{Math.floor(vGlobal.soaekNewTR || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-amber-800"><span>시공지급(TC):</span> <span>₩{Math.floor(vGlobal.soaekNewTC || 0).toLocaleString()}</span></p>
                    <p className="flex justify-between text-amber-800"><span>기타지급:</span> <span>₩{Math.floor(soaekExpense).toLocaleString()}</span></p>
                    <p className="flex justify-between font-bold text-amber-900 border-t border-amber-200 pt-1">
                      <span>공헌이익:</span> <span>₩{Math.floor(soaekNewContrib).toLocaleString()} ({soaekNewContribRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-semibold text-indigo-900">
                      <span>영업이익:</span> <span>₩{Math.floor(soaekNewOpProfit).toLocaleString()} ({soaekNewOpProfitRate.toFixed(1)}%)</span>
                    </p>
                    <p className="flex justify-between font-bold text-purple-900 border-t border-amber-200 pt-0.5">
                      <span>채산이익:</span> <span>₩{Math.floor(soaekNewNetProfit).toLocaleString()} ({soaekNewNetProfitRate.toFixed(1)}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-10 mb-8">
              {/* --- 현장 vs 소액 부문별 공헌/영업/채산이익 상세 비교 표 --- */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">★</span>
                  현장 vs 소액 부문별 전체 손익 상세 비교 (기타지급/영업이익/채산이익 반영)
                </h3>
                <table className="min-w-full text-sm text-left border-collapse">
                   <thead className="bg-gray-100 text-gray-700 border-y-2 border-gray-300">
                     <tr>
                       <th className="p-2.5">부문 (Category)</th>
                       <th className="p-2.5 text-right text-gray-500">기존 청구(TR)</th>
                       <th className="p-2.5 text-right text-gray-500">기존 시공지급(TC)</th>
                       <th className="p-2.5 text-right text-gray-500">기타지급</th>
                       <th className="p-2.5 text-right text-gray-700 font-bold">기존 공헌이익(율)</th>
                       <th className="p-2.5 text-right text-indigo-800 font-bold">기존 영업이익(율)</th>
                       <th className="p-2.5 text-right text-purple-800 font-bold">기존 채산이익(율)</th>
                       <th className="p-2.5 text-right text-blue-600 font-bold">시뮬 청구(TR)</th>
                       <th className="p-2.5 text-right text-red-600 font-bold">시뮬 시공지급(TC)</th>
                       <th className="p-2.5 text-right text-emerald-600 font-bold">시뮬 공헌이익(율)</th>
                       <th className="p-2.5 text-right text-indigo-900 font-bold">시뮬 영업이익(율)</th>
                       <th className="p-2.5 text-right text-purple-900 font-bold">시뮬 채산이익(율)</th>
                       <th className="p-2.5 text-center text-gray-700 font-bold">채산이익 증감률</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr className="border-b border-gray-200 bg-blue-50/30 hover:bg-blue-50/60 font-bold text-xs">
                       <td className="p-2.5 text-blue-900 text-sm">🏗️ 현장 부문 (Total Field)</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(vGlobal.hyunOldTR || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(vGlobal.hyunOldTC || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(hyunExpense).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-700">₩{Math.floor(hyunOldContrib).toLocaleString()} ({hyunOldContribRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-indigo-800">₩{Math.floor(hyunOldOpProfit).toLocaleString()} ({hyunOldOpProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-purple-800">₩{Math.floor(hyunOldNetProfit).toLocaleString()} ({hyunOldNetProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-blue-600">₩{Math.floor(vGlobal.hyunNewTR || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-red-600">₩{Math.floor(vGlobal.hyunNewTC || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-emerald-600">₩{Math.floor(hyunNewContrib).toLocaleString()} ({hyunNewContribRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-indigo-900">₩{Math.floor(hyunNewOpProfit).toLocaleString()} ({hyunNewOpProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-purple-900">₩{Math.floor(hyunNewNetProfit).toLocaleString()} ({hyunNewNetProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-center">{formatDiffText(hyunOldNetProfit ? ((hyunNewNetProfit - hyunOldNetProfit) / Math.abs(hyunOldNetProfit)) * 100 : 0)}</td>
                     </tr>
                     <tr className="border-b border-gray-200 bg-amber-50/30 hover:bg-amber-50/60 font-bold text-xs">
                       <td className="p-2.5 text-amber-900 text-sm">📦 소액 부문 (Total Small)</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(vGlobal.soaekOldTR || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(vGlobal.soaekOldTC || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-500">₩{Math.floor(soaekExpense).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-gray-700">₩{Math.floor(soaekOldContrib).toLocaleString()} ({soaekOldContribRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-indigo-800">₩{Math.floor(soaekOldOpProfit).toLocaleString()} ({soaekOldOpProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-purple-800">₩{Math.floor(soaekOldNetProfit).toLocaleString()} ({soaekOldNetProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-blue-600">₩{Math.floor(vGlobal.soaekNewTR || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-red-600">₩{Math.floor(vGlobal.soaekNewTC || 0).toLocaleString()}</td>
                       <td className="p-2.5 text-right text-emerald-600">₩{Math.floor(soaekNewContrib).toLocaleString()} ({soaekNewContribRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-indigo-900">₩{Math.floor(soaekNewOpProfit).toLocaleString()} ({soaekNewOpProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-right text-purple-900">₩{Math.floor(soaekNewNetProfit).toLocaleString()} ({soaekNewNetProfitRate.toFixed(1)}%)</td>
                       <td className="p-2.5 text-center">{formatDiffText(soaekOldNetProfit ? ((soaekNewNetProfit - soaekOldNetProfit) / Math.abs(soaekOldNetProfit)) * 100 : 0)}</td>
                     </tr>
                   </tbody>
                </table>
              </div>
             {/* --- 1) 센터별 상세 결과 표 (7개 센터) --- */}
             <div>
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
                      <th className="p-3 text-right text-gray-600 font-bold">기존 공헌이익</th>
                      <th className="p-3 text-right text-gray-600 font-bold">기존 공헌이익률</th>
                      <th className="p-3 text-right text-blue-600 font-bold">시뮬 청구(TR)</th>
                      <th className="p-3 text-right text-red-600 font-bold">시뮬 지급(TC)</th>
                      <th className="p-3 text-right text-emerald-600 font-bold">시뮬 공헌이익</th>
                      <th className="p-3 text-right text-emerald-600 font-bold">시뮬 공헌이익률</th>
                      <th className="p-3 text-center text-gray-700 font-bold">청구 증감률</th>
                      <th className="p-3 text-center text-gray-700 font-bold">지급 증감률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewedData.centerData.map((c, cIdx) => {
                      const cTrDiff = c.TR_old ? ((c.TR_new - c.TR_old) / c.TR_old) * 100 : 0;
                      const cTcDiff = c.TC_old ? ((c.TC_new - c.TC_old) / c.TC_old) * 100 : 0;
                      const cOldContrib = c.TR_old - c.TC_old;
                      const cOldContribRate = c.TR_old ? (cOldContrib / c.TR_old) * 100 : 0;
                      const cNewContrib = c.TR_new - c.TC_new;
                      const cNewContribRate = c.TR_new ? (cNewContrib / c.TR_new) * 100 : 0;
                      
                      return (
                        <tr key={`c-${cIdx}`} className="border-b border-gray-200 bg-white hover:bg-gray-50 font-bold">
                          <td className="p-3 text-gray-800">🏢 {c.center}</td>
                          <td className="p-3 text-right text-gray-600">₩{Math.floor(c.baseCost).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(c.TR_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">₩{Math.floor(c.TC_old).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-600">₩{Math.floor(cOldContrib).toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-600">{cOldContribRate.toFixed(1)}%</td>
                          <td className="p-3 text-right text-blue-600">₩{Math.floor(c.TR_new).toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600">₩{Math.floor(c.TC_new).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600">₩{Math.floor(cNewContrib).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600">{cNewContribRate.toFixed(1)}%</td>
                          <td className="p-3 text-center">{formatDiffText(cTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiffText(cTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>

             {/* --- 2) 권역시공팀별 상세 결과 표 --- */}
             <div>
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
                    {viewedData.teamData.map((t, tIdx) => {
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
                          <td className="p-3 text-center">{formatDiffText(tTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiffText(tTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>

             {/* --- 3) 월별 상세 결과 표 --- */}
             <div>
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
                    {viewedData.monthlyData.map((m, mIdx) => {
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
                          <td className="p-3 text-center">{formatDiffText(mTrDiff)}</td>
                          <td className="p-3 text-center">{formatDiffText(mTcDiff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
             </div>
           </div>

           {/* --- ⏰ 확정시간별 분포 분석 카드 (24시간 분석 - 맨 아래) --- */}
           <div className="bg-white p-6 rounded-xl border border-gray-200">
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
                 const totalAmountSum = viewedData.hourlyAmounts?.reduce((a, b) => a + b, 0) || 1;
                 
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
  );
}