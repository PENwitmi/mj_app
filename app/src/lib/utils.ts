import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { UmaRule } from './db'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ========================================
// LocalStorage Management
// ========================================

const STORAGE_KEYS = {
  DEFAULT_UMA_RULE: 'mj_app_default_uma_rule',
} as const

/**
 * デフォルトウマルールを取得
 * @returns UmaRule - localStorageから取得、なければ'standard'
 */
export function getDefaultUmaRule(): UmaRule {
  const stored = localStorage.getItem(STORAGE_KEYS.DEFAULT_UMA_RULE)
  if (stored === 'standard' || stored === 'second-minus') {
    return stored
  }
  return 'standard'
}

/**
 * デフォルトウマルールを保存
 * @param rule - 保存するウマルール
 */
export function setDefaultUmaRule(rule: UmaRule): void {
  localStorage.setItem(STORAGE_KEYS.DEFAULT_UMA_RULE, rule)
}
