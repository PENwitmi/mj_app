// ========================================
// Public API - Re-exports from Domain Modules
// ========================================

// ユーザー管理
export {
  getMainUser,
  getAllUsers,
  getRegisteredUsers,
  addUser,
  updateUser,
  archiveUser,
  restoreUser,
  getActiveUsers,
  getArchivedUsers,
  deleteUser
} from './users';

// セッション管理
export {
  createSession,
  getSessionsByDate,
  getAllSessions,
  saveSession,
  deleteSession,
  updateSession,
  updateSessionMemo,
  sessionToSettings,
  dbHanchansToUIHanchans,
  uiDataToSaveData
} from './sessions';
export type { SessionSaveData, UIHanchan, UIPlayerResult } from './sessions';

// 半荘・プレイヤー結果
export {
  createHanchan,
  getHanchansBySession,
  createPlayerResult,
  getPlayerResultsByHanchan,
  getSessionWithDetails,
  getUserStats
} from './hanchans';

// バリデーション
export {
  validateZeroSum,
  validateUmaMarks
} from './validation';

// 分析統計
export {
  calculateRankStatistics,
  calculateRecordStatistics,
  calculateAllStatistics,
  filterSessionsByPeriod,
  filterSessionsByMode
} from './analysis';
export type {
  PeriodType,
  AnalysisFilter,
  RankStatistics,
  RevenueStatistics,
  PointStatistics,
  ChipStatistics,
  RecordStatistics,
  AnalysisStatistics,
  ExtendedRevenueStatistics,
  BasicStatistics,
  AllStatistics,
  FilteredSession
} from './analysis';

// テンプレート管理
export {
  createTemplate,
  getAllTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  createTemplateFromSession
} from './templates';
export type { TemplateFormData } from './templates';
