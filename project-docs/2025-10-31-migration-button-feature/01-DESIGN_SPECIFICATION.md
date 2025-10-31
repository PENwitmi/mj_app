# Migration Button Feature - Design Specification

**Document Version:** 1.0
**Created:** 2025-10-31 16:33
**Status:** Design Phase

## Table of Contents
1. [Overview](#overview)
2. [Background & Problem Statement](#background--problem-statement)
3. [Requirements](#requirements)
4. [UI/UX Design](#uiux-design)
5. [Technical Architecture](#technical-architecture)
6. [Implementation Details](#implementation-details)
7. [Error Handling Strategy](#error-handling-strategy)
8. [Testing Strategy](#testing-strategy)
9. [Edge Cases](#edge-cases)
10. [Migration Checklist](#migration-checklist)
11. [Future Considerations](#future-considerations)

---

## Overview

A migration button feature that recalculates all existing session summaries in IndexedDB using the corrected calculation logic. The bug fix (chips/parlorFee being multiplied by hanchan count) is already in the codebase, but existing data still has incorrect pre-calculated summaries.

**Target User:** Both technical and non-technical users
**Location:** Settings tab (SettingsTab.tsx)
**Platform:** Web (current), iOS via Capacitor (future)

---

## Background & Problem Statement

### The Bug
Previously, `calculateSessionSummary()` incorrectly multiplied chips and parlorFee by the number of hanchans (games), resulting in inflated payout calculations.

**Example of the Bug:**
- Correct: 3 games × 1000 chips/game = 3000 chips total → Apply chipRate once → 300 payout
- Bug: 3 games → Apply chipRate 3 times → 900 payout (3x inflation)

### The Fix
The fix (already implemented in `src/lib/session-utils.ts` lines 115-179) ensures:
- chips/parlorFee are extracted from the first valid hanchan only
- Applied to session total exactly once

### The Problem
Existing sessions in IndexedDB have pre-calculated `summary` fields with incorrect values. Users need a way to recalculate all summaries without losing their data.

---

## Requirements

### Functional Requirements
1. **FR-1:** Recalculate all session summaries using `calculateSessionSummary()`
2. **FR-2:** Provide real-time progress feedback (current/total sessions)
3. **FR-3:** Display success/failure status clearly
4. **FR-4:** Handle partial failures gracefully (continue processing remaining sessions)
5. **FR-5:** Be idempotent (safe to run multiple times)
6. **FR-6:** Work offline (IndexedDB only, no network required)

### Non-Functional Requirements
1. **NFR-1:** Processing should not block UI (use async/await with progress updates)
2. **NFR-2:** Must work on both web and future iOS app
3. **NFR-3:** Provide clear user guidance (when to run, what it does)
4. **NFR-4:** Error messages should be user-friendly (Japanese)
5. **NFR-5:** Performance: Handle up to 1000 sessions reasonably fast (<30s)

### User Stories
1. **As a user**, I want to recalculate my session summaries so that my statistics are correct after the bug fix
2. **As a user**, I want to see progress during migration so I know the app hasn't frozen
3. **As a user**, I want clear feedback about success/failure so I know if I need to retry
4. **As a technical user**, I want detailed error logs for troubleshooting

---

## UI/UX Design

### Component Hierarchy
```
SettingsTab
└── Card (Migration section)
    ├── CardHeader
    │   ├── CardTitle: "📊 データ修正ツール"
    │   └── CardDescription: Summary of what this does
    ├── CardContent
    │   ├── InfoSection (What/When/Why)
    │   ├── StatusDisplay (current state)
    │   └── MigrationButton
    └── MigrationDialog (during execution)
        ├── Progress Bar
        ├── Status Text
        └── Results Display
```

### Visual States

#### State 1: Initial (Not Run Yet)
```
┌─────────────────────────────────────────┐
│ 📊 データ修正ツール                      │
│                                         │
│ セッションサマリーの再計算              │
│ 最新の計算ロジックで統計を修正します    │
├─────────────────────────────────────────┤
│ ℹ️ 実行が推奨される場合:                │
│ • 2025年10月31日以前にデータを保存      │
│ • 統計の収支が実際より大きい気がする    │
│                                         │
│ ⚠️ 注意:                                │
│ • 処理中はアプリを閉じないでください    │
│ • 何度実行しても問題ありません          │
│                                         │
│ [データを修正する] (Button)             │
└─────────────────────────────────────────┘
```

#### State 2: Confirmation Dialog
```
┌─────────────────────────────────────────┐
│ データ修正の確認                        │
├─────────────────────────────────────────┤
│ 対象: 15件のセッション                  │
│                                         │
│ すべてのセッションの統計を再計算します。│
│ 元データは保持され、統計のみ修正されます│
│                                         │
│ 処理には数秒〜数十秒かかる場合があります│
│                                         │
│ [キャンセル] [実行する] (Buttons)       │
└─────────────────────────────────────────┘
```

#### State 3: Processing
```
┌─────────────────────────────────────────┐
│ データ修正中...                         │
├─────────────────────────────────────────┤
│ [██████████░░░░░░░░░░] 50%             │
│                                         │
│ 処理中: 15 / 30 セッション              │
│                                         │
│ ⚠️ アプリを閉じないでください           │
│                                         │
│ [キャンセル] (Disabled during process)  │
└─────────────────────────────────────────┘
```

#### State 4: Success
```
┌─────────────────────────────────────────┐
│ ✅ 修正完了                             │
├─────────────────────────────────────────┤
│ 30件のセッションを修正しました          │
│                                         │
│ • 成功: 30件                            │
│ • 失敗: 0件                             │
│                                         │
│ 履歴タブで修正後の統計を確認できます    │
│                                         │
│ [閉じる] (Button)                       │
└─────────────────────────────────────────┘
```

#### State 5: Partial Failure
```
┌─────────────────────────────────────────┐
│ ⚠️ 一部のデータを修正できませんでした    │
├─────────────────────────────────────────┤
│ • 成功: 28件                            │
│ • 失敗: 2件                             │
│                                         │
│ 失敗したセッション:                     │
│ • 2025-10-15 (ID: abc123...)            │
│ • 2025-10-20 (ID: def456...)            │
│                                         │
│ もう一度実行するか、サポートに連絡      │
│ してください                            │
│                                         │
│ [再試行] [閉じる] (Buttons)             │
└─────────────────────────────────────────┘
```

#### State 6: Complete Failure
```
┌─────────────────────────────────────────┐
│ ❌ エラーが発生しました                 │
├─────────────────────────────────────────┤
│ データの修正中に問題が発生しました      │
│                                         │
│ エラー: データベース接続エラー          │
│                                         │
│ しばらく待ってから再度お試しください    │
│                                         │
│ [閉じる] (Button)                       │
└─────────────────────────────────────────┘
```

#### State 7: No Data
```
┌─────────────────────────────────────────┐
│ ℹ️ 修正するデータがありません           │
├─────────────────────────────────────────┤
│ セッションが登録されていないため、      │
│ 修正は不要です                          │
│                                         │
│ [閉じる] (Button)                       │
└─────────────────────────────────────────┘
```

### Button Placement
The migration tool should be placed in the Settings tab as a new Card section, positioned:
- **After:** Default Uma Rule setting
- **Before:** Footer/bottom spacing

### Color Scheme
- **Primary Action:** Default button color (blue)
- **Success:** Green (`bg-green-500`)
- **Warning:** Orange (`bg-orange-500`)
- **Error:** Red (`bg-red-500`)
- **Progress Bar:** Blue gradient (`bg-primary`)

### Accessibility
- Proper ARIA labels for progress bar
- Clear focus states for keyboard navigation
- Screen reader announcements for status changes
- Sufficient color contrast (WCAG AA compliant)

---

## Technical Architecture

### Component Structure

```typescript
// New Component: MigrationTool.tsx
interface MigrationState {
  status: 'idle' | 'confirming' | 'processing' | 'success' | 'error' | 'no-data'
  totalSessions: number
  processedSessions: number
  successCount: number
  failedSessions: Array<{ sessionId: string; date: string; error: string }>
  errorMessage: string | null
}

// Hook: useMigration.ts
interface UseMigrationReturn {
  state: MigrationState
  startMigration: () => Promise<void>
  resetMigration: () => void
}
```

### Data Flow

```
User clicks button
  ↓
Fetch all sessions (db.sessions.toArray())
  ↓
Check if sessions exist
  ↓ YES
Show confirmation dialog
  ↓ User confirms
Start migration loop
  ↓
For each session:
  ├─ Call calculateSessionSummary(sessionId, mainUserId)
  ├─ Update session.summary in DB
  ├─ Update progress state
  └─ Log errors (continue on failure)
  ↓
Show final results
```

### Database Operations

```typescript
// Read operations
const sessions = await db.sessions.toArray()
const mainUser = await db.users.get('main-user-fixed-id')

// Write operation (per session)
await db.sessions.update(sessionId, { summary: newSummary })
```

### Performance Considerations

**Batch Size:** Process all sessions in a single pass (no chunking needed for <1000 sessions)

**Why no chunking?**
- IndexedDB is fast for local operations
- `calculateSessionSummary()` is already optimized
- UI responsiveness maintained via React state updates

**Estimated Performance:**
- 10 sessions: <1 second
- 100 sessions: 2-5 seconds
- 1000 sessions: 15-30 seconds

**If performance becomes an issue (>1000 sessions):**
- Implement chunking (process 50 sessions at a time)
- Add `requestIdleCallback()` for better UI responsiveness

---

## Implementation Details

### File Structure

```
src/
├── components/
│   ├── tabs/
│   │   └── SettingsTab.tsx          # Add migration section here
│   └── MigrationTool.tsx             # NEW: Main migration component
├── hooks/
│   └── useMigration.ts               # NEW: Migration logic hook
└── lib/
    └── migration-utils.ts            # NEW: Migration utilities
```

### Core Functions

#### 1. `useMigration.ts` (React Hook)

```typescript
import { useState, useCallback } from 'react'
import { db } from '@/lib/db'
import { calculateSessionSummary } from '@/lib/session-utils'
import { logger } from '@/lib/logger'
import { DatabaseError } from '@/lib/errors'

interface MigrationState {
  status: 'idle' | 'confirming' | 'processing' | 'success' | 'error' | 'no-data'
  totalSessions: number
  processedSessions: number
  successCount: number
  failedSessions: Array<{ sessionId: string; date: string; error: string }>
  errorMessage: string | null
}

const initialState: MigrationState = {
  status: 'idle',
  totalSessions: 0,
  processedSessions: 0,
  successCount: 0,
  failedSessions: [],
  errorMessage: null
}

export function useMigration() {
  const [state, setState] = useState<MigrationState>(initialState)
  const MAIN_USER_ID = 'main-user-fixed-id'

  const startMigration = useCallback(async () => {
    logger.info('Migration started', { context: 'useMigration.startMigration' })

    try {
      // 1. Fetch all sessions
      const sessions = await db.sessions.toArray()

      if (sessions.length === 0) {
        setState({ ...initialState, status: 'no-data' })
        logger.info('No sessions found for migration', {
          context: 'useMigration.startMigration'
        })
        return
      }

      // 2. Set initial state
      setState({
        ...initialState,
        status: 'processing',
        totalSessions: sessions.length
      })

      let successCount = 0
      const failedSessions: Array<{ sessionId: string; date: string; error: string }> = []

      // 3. Process each session
      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i]

        try {
          // Calculate new summary
          const newSummary = await calculateSessionSummary(session.id, MAIN_USER_ID)

          // Update session in DB
          await db.sessions.update(session.id, { summary: newSummary })

          successCount++

          logger.debug('Session migrated successfully', {
            context: 'useMigration.startMigration',
            data: { sessionId: session.id, date: session.date }
          })
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'

          failedSessions.push({
            sessionId: session.id,
            date: session.date,
            error: errorMessage
          })

          logger.error('Failed to migrate session', {
            context: 'useMigration.startMigration',
            data: { sessionId: session.id, date: session.date },
            error: err instanceof Error ? err : new Error(String(err))
          })
        }

        // 4. Update progress
        setState(prev => ({
          ...prev,
          processedSessions: i + 1,
          successCount,
          failedSessions
        }))
      }

      // 5. Set final state
      const finalStatus = failedSessions.length === 0 ? 'success' :
                         failedSessions.length === sessions.length ? 'error' : 'success'

      setState(prev => ({
        ...prev,
        status: finalStatus,
        errorMessage: failedSessions.length > 0
          ? `${failedSessions.length}件のセッションで問題が発生しました`
          : null
      }))

      logger.info('Migration completed', {
        context: 'useMigration.startMigration',
        data: {
          total: sessions.length,
          success: successCount,
          failed: failedSessions.length
        }
      })

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('Migration failed', {
        context: 'useMigration.startMigration',
        error
      })

      setState({
        ...initialState,
        status: 'error',
        errorMessage: error.message
      })
    }
  }, [])

  const resetMigration = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    state,
    startMigration,
    resetMigration
  }
}
```

#### 2. `MigrationTool.tsx` (Component)

```typescript
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useMigration } from '@/hooks/useMigration'

export function MigrationTool() {
  const { state, startMigration, resetMigration } = useMigration()
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  const handleStartClick = async () => {
    // Show confirmation first
    setConfirmDialogOpen(true)
  }

  const handleConfirm = async () => {
    setConfirmDialogOpen(false)
    await startMigration()
  }

  const handleClose = () => {
    resetMigration()
  }

  const progressPercentage = state.totalSessions > 0
    ? (state.processedSessions / state.totalSessions) * 100
    : 0

  return (
    <>
      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle>📊 データ修正ツール</CardTitle>
          <CardDescription>
            セッションサマリーの再計算 - 最新の計算ロジックで統計を修正します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Section */}
          <div className="border rounded-lg p-4 bg-blue-50 space-y-2">
            <p className="text-sm font-medium">ℹ️ 実行が推奨される場合:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• 2025年10月31日以前にデータを保存した</li>
              <li>• 統計の収支が実際より大きい気がする</li>
            </ul>
          </div>

          <div className="border rounded-lg p-4 bg-orange-50 space-y-2">
            <p className="text-sm font-medium">⚠️ 注意:</p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• 処理中はアプリを閉じないでください</li>
              <li>• 何度実行しても問題ありません（冪等性保証）</li>
              <li>• 元の点数データは保持されます</li>
            </ul>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleStartClick}
            disabled={state.status === 'processing'}
            className="w-full"
          >
            {state.status === 'processing' ? '処理中...' : 'データを修正する'}
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>データ修正の確認</DialogTitle>
            <DialogDescription>
              すべてのセッションの統計を再計算します
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <p className="text-sm">
              元のデータは保持され、統計情報のみが修正されます。
            </p>
            <p className="text-sm text-muted-foreground">
              処理には数秒〜数十秒かかる場合があります。
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleConfirm}>
              実行する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={state.status === 'processing'} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>データ修正中...</DialogTitle>
            <DialogDescription>
              処理が完了するまでお待ちください
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <Progress value={progressPercentage} />
            <div className="text-center">
              <p className="text-lg font-medium">
                {state.processedSessions} / {state.totalSessions} セッション
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {progressPercentage.toFixed(0)}%
              </p>
            </div>
            <p className="text-sm text-center text-orange-600 font-medium">
              ⚠️ アプリを閉じないでください
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog (Success) */}
      <Dialog open={state.status === 'success'} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {state.failedSessions.length === 0 ? '✅ 修正完了' : '⚠️ 一部のデータを修正できませんでした'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {state.failedSessions.length === 0 ? (
              <>
                <p className="text-lg font-medium">
                  {state.successCount}件のセッションを修正しました
                </p>
                <div className="space-y-1 text-sm">
                  <p>• 成功: {state.successCount}件</p>
                  <p>• 失敗: 0件</p>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  履歴タブで修正後の統計を確認できます
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1 text-sm">
                  <p>• 成功: {state.successCount}件</p>
                  <p>• 失敗: {state.failedSessions.length}件</p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">失敗したセッション:</p>
                  <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                    {state.failedSessions.map((failed, idx) => (
                      <div key={idx}>
                        • {failed.date} (ID: {failed.sessionId.slice(0, 8)}...)
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  もう一度実行するか、サポートに連絡してください
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            {state.failedSessions.length > 0 && (
              <Button variant="outline" onClick={handleStartClick}>
                再試行
              </Button>
            )}
            <Button onClick={handleClose}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog (Error) */}
      <Dialog open={state.status === 'error'} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>❌ エラーが発生しました</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-sm">
              データの修正中に問題が発生しました
            </p>
            {state.errorMessage && (
              <div className="border rounded-lg p-3 bg-red-50">
                <p className="text-sm font-medium text-red-800">
                  エラー: {state.errorMessage}
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              しばらく待ってから再度お試しください
            </p>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialog (No Data) */}
      <Dialog open={state.status === 'no-data'} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ℹ️ 修正するデータがありません</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm">
              セッションが登録されていないため、修正は不要です
            </p>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

#### 3. Integration in `SettingsTab.tsx`

```typescript
// Add import
import { MigrationTool } from '@/components/MigrationTool'

// Add in render, after Default Uma Rule section
export function SettingsTab({ ... }: SettingsTabProps) {
  // ... existing code ...

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-4">
        <Card>
          {/* Existing User Management and Uma Rule sections */}
        </Card>

        {/* NEW: Migration Tool */}
        <MigrationTool />
      </div>
    </div>
  )
}
```

#### 4. `migration-utils.ts` (Helper Functions)

```typescript
import { db } from '@/lib/db'
import { calculateSessionSummary } from '@/lib/session-utils'
import { logger } from '@/lib/logger'

export interface MigrationResult {
  totalSessions: number
  successCount: number
  failedSessions: Array<{
    sessionId: string
    date: string
    error: string
  }>
}

/**
 * Run migration for all sessions
 * This is the core migration function (used by useMigration hook)
 */
export async function runSessionMigration(
  mainUserId: string
): Promise<MigrationResult> {
  logger.info('Starting session migration', {
    context: 'migration-utils.runSessionMigration',
    data: { mainUserId }
  })

  const sessions = await db.sessions.toArray()
  const totalSessions = sessions.length
  let successCount = 0
  const failedSessions: Array<{
    sessionId: string
    date: string
    error: string
  }> = []

  for (const session of sessions) {
    try {
      const newSummary = await calculateSessionSummary(session.id, mainUserId)
      await db.sessions.update(session.id, { summary: newSummary })
      successCount++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      failedSessions.push({
        sessionId: session.id,
        date: session.date,
        error: errorMessage
      })

      logger.error('Session migration failed', {
        context: 'migration-utils.runSessionMigration',
        data: { sessionId: session.id, date: session.date },
        error: err instanceof Error ? err : new Error(String(err))
      })
    }
  }

  logger.info('Session migration completed', {
    context: 'migration-utils.runSessionMigration',
    data: { totalSessions, successCount, failedCount: failedSessions.length }
  })

  return {
    totalSessions,
    successCount,
    failedSessions
  }
}

/**
 * Check if migration is needed
 * (Optional: could be used to show/hide the migration tool)
 */
export async function isMigrationNeeded(): Promise<boolean> {
  // Simple heuristic: if any session lacks a summary, migration might be needed
  const sessions = await db.sessions.toArray()
  return sessions.some(session => !session.summary)
}
```

---

## Error Handling Strategy

### Error Categories

#### 1. Database Errors
**Cause:** IndexedDB connection issues, quota exceeded, corruption

**Handling:**
- Catch in `useMigration.startMigration`
- Log with `logger.error()`
- Show user-friendly message: "データベース接続エラーが発生しました"
- Allow retry

**Example:**
```typescript
try {
  await db.sessions.update(sessionId, { summary })
} catch (err) {
  if (err.name === 'QuotaExceededError') {
    throw new DatabaseError('ストレージ容量が不足しています')
  }
  throw new DatabaseError('データベースエラーが発生しました', { originalError: err })
}
```

#### 2. Calculation Errors
**Cause:** Missing data, invalid session structure, missing main user

**Handling:**
- Catch per-session (continue to next session)
- Log failed session ID and date
- Include in `failedSessions` array
- Show partial success UI

**Example:**
```typescript
try {
  const summary = await calculateSessionSummary(sessionId, mainUserId)
} catch (err) {
  failedSessions.push({
    sessionId,
    date: session.date,
    error: err.message
  })
  // Continue processing
}
```

#### 3. User Interruption
**Cause:** User navigates away during migration

**Handling:**
- No explicit cancellation (migration is idempotent)
- On page reload, migration state resets to 'idle'
- User can restart migration if needed

**Future Enhancement:**
```typescript
// Add cancellation support
const abortController = new AbortController()

const startMigration = async () => {
  for (const session of sessions) {
    if (abortController.signal.aborted) {
      break
    }
    // ... process session
  }
}

const cancelMigration = () => {
  abortController.abort()
}
```

### Logging Strategy

**Development:**
```typescript
logger.debug('Session migrated', { sessionId, summary })
```

**Production:**
```typescript
logger.info('Migration completed', {
  totalSessions,
  successCount,
  failedCount
})

logger.error('Session migration failed', {
  sessionId,
  date,
  error
})
```

### User Feedback

**Error Messages (Japanese):**
- Database error: "データベースエラーが発生しました"
- Calculation error: "統計の計算中に問題が発生しました"
- Partial failure: "一部のデータを修正できませんでした"
- Complete failure: "エラーが発生しました"

**Error Display:**
- Main error message in Dialog title
- Detailed error (if available) in Dialog body
- Failed session list (scrollable if many)
- Retry button for partial/complete failures

---

## Testing Strategy

### Unit Tests

```typescript
// tests/useMigration.test.ts
describe('useMigration', () => {
  it('should process all sessions successfully', async () => {
    // Mock db.sessions.toArray() to return 3 sessions
    // Assert final state: status='success', successCount=3, failedSessions=[]
  })

  it('should handle partial failures', async () => {
    // Mock calculateSessionSummary to fail for 1 session
    // Assert final state: status='success', successCount=2, failedSessions.length=1
  })

  it('should handle complete failure', async () => {
    // Mock db.sessions.toArray() to throw error
    // Assert final state: status='error', errorMessage set
  })

  it('should handle no sessions', async () => {
    // Mock db.sessions.toArray() to return []
    // Assert final state: status='no-data'
  })

  it('should be idempotent', async () => {
    // Run migration twice
    // Assert same results both times
  })
})
```

### Integration Tests

```typescript
// tests/migration-integration.test.ts
describe('Migration Integration', () => {
  beforeEach(async () => {
    // Setup test IndexedDB with sample data
  })

  it('should recalculate summaries correctly', async () => {
    // Create session with old (incorrect) summary
    // Run migration
    // Assert summary matches calculateSessionSummary result
  })

  it('should preserve original data', async () => {
    // Store original session/hanchan/playerResult data
    // Run migration
    // Assert only summary field changed
  })
})
```

### Manual Testing Checklist

#### Happy Path
- [ ] No sessions: Shows "no data" message
- [ ] 1 session: Migrates successfully
- [ ] 10 sessions: Progress bar updates smoothly
- [ ] 100 sessions: Completes within 5 seconds

#### Error Cases
- [ ] Invalid session data: Shows partial failure
- [ ] Missing main user: Logs warning, continues
- [ ] IndexedDB quota exceeded: Shows clear error message

#### UI/UX
- [ ] Confirmation dialog appears
- [ ] Progress bar updates in real-time
- [ ] Success dialog shows correct counts
- [ ] Retry button works after partial failure
- [ ] Can run migration multiple times (idempotent)

#### Cross-Platform
- [ ] Works in Chrome (IndexedDB support)
- [ ] Works in Safari (IndexedDB support)
- [ ] Works in iOS Safari (future Capacitor app)

---

## Edge Cases

### 1. No Sessions in Database
**Scenario:** User has never created a session

**Handling:**
- Show "no data" dialog immediately
- No processing occurs
- No errors logged

**Implementation:**
```typescript
if (sessions.length === 0) {
  setState({ ...initialState, status: 'no-data' })
  return
}
```

---

### 2. Session Without Main User
**Scenario:** Session data exists but main user never participated

**Handling:**
- `calculateSessionSummary` logs warning
- Returns empty summary (zero values)
- Migration continues
- Counted as success (no error thrown)

**Current Implementation:**
Already handled in `session-utils.ts` (lines 127-136):
```typescript
if (!mainUserResult) {
  logger.warn('Main user not found in hanchan', { ... })
  continue  // Skip this hanchan
}
```

---

### 3. Corrupted Session Data
**Scenario:** Session has missing hanchans or invalid data structure

**Handling:**
- `calculateSessionSummary` throws error
- Caught by migration loop
- Added to `failedSessions` array
- Other sessions continue processing
- Shown in partial failure dialog

**Implementation:**
```typescript
try {
  const summary = await calculateSessionSummary(sessionId, mainUserId)
  await db.sessions.update(sessionId, { summary })
} catch (err) {
  failedSessions.push({
    sessionId,
    date: session.date,
    error: err.message
  })
  // Continue loop
}
```

---

### 4. User Navigates Away During Migration
**Scenario:** User closes tab or navigates to another tab mid-migration

**Handling:**
- Migration state is lost (React component unmounts)
- IndexedDB writes are atomic (partially completed writes persist)
- User can re-run migration (idempotent)
- Only unprocessed sessions will have old summaries

**Future Enhancement:**
- Add `localStorage` checkpoint for resume capability
- Show warning if user tries to navigate away

---

### 5. Multiple Runs (Idempotency)
**Scenario:** User runs migration multiple times

**Handling:**
- Each run recalculates all summaries from scratch
- Results are identical (same calculation logic)
- No side effects (no data corruption)
- Safe to run repeatedly

**Verification:**
```typescript
// Test
const summary1 = await calculateSessionSummary(sessionId, mainUserId)
const summary2 = await calculateSessionSummary(sessionId, mainUserId)
expect(summary1).toEqual(summary2)  // Idempotent
```

---

### 6. IndexedDB Quota Exceeded
**Scenario:** Database storage limit reached during migration

**Handling:**
- Caught in migration loop
- Show error: "ストレージ容量が不足しています"
- Suggest deleting old sessions
- Allow retry after cleanup

**Implementation:**
```typescript
try {
  await db.sessions.update(sessionId, { summary })
} catch (err) {
  if (err instanceof Error && err.name === 'QuotaExceededError') {
    setState({
      ...prev,
      status: 'error',
      errorMessage: 'ストレージ容量が不足しています。不要なセッションを削除してください'
    })
    return  // Stop migration
  }
  throw err
}
```

---

### 7. Very Large Number of Sessions (>1000)
**Scenario:** User has accumulated many sessions over time

**Handling (Current):**
- Process all in single pass
- May take 30+ seconds
- UI updates show progress
- No timeout (IndexedDB operations are local)

**Future Optimization (if needed):**
```typescript
// Chunked processing
const CHUNK_SIZE = 50
for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
  const chunk = sessions.slice(i, i + CHUNK_SIZE)
  await processChunk(chunk)
  await new Promise(resolve => requestIdleCallback(resolve))
}
```

---

### 8. Session Summary Already Correct
**Scenario:** User runs migration on already-migrated data

**Handling:**
- Recalculates anyway (idempotent)
- Summary unchanged (same calculation result)
- No harm done
- Shows success

**No special handling needed** - idempotency ensures safety

---

### 9. React Strict Mode Double Execution
**Scenario:** Development mode triggers useEffect twice

**Handling:**
- Migration is triggered by button click (not useEffect)
- User must explicitly start migration
- No automatic execution on mount
- No double execution risk

---

### 10. Future Capacitor App (Offline)
**Scenario:** Migration runs in iOS app without network

**Handling:**
- IndexedDB works offline (local storage)
- No network dependency
- Works identically to web version
- No additional code needed

---

## Migration Checklist

### Pre-Implementation Checklist
- [ ] Read and understand existing `calculateSessionSummary()` logic
- [ ] Review error handling patterns in existing code
- [ ] Confirm UI component library (shadcn/ui) usage
- [ ] Verify React 19 compatibility

### Implementation Checklist
- [ ] Create `src/hooks/useMigration.ts`
- [ ] Create `src/components/MigrationTool.tsx`
- [ ] Create `src/lib/migration-utils.ts`
- [ ] Add `<MigrationTool />` to `SettingsTab.tsx`
- [ ] Add Progress component if not in shadcn/ui
- [ ] Implement all 7 UI states (idle, confirming, processing, success, error, no-data, partial failure)
- [ ] Add proper TypeScript types
- [ ] Add JSDoc comments for public functions
- [ ] Add logger statements (DEBUG, INFO, ERROR levels)

### Testing Checklist
- [ ] Unit tests for useMigration hook
- [ ] Integration test with real IndexedDB
- [ ] Manual test: No sessions
- [ ] Manual test: 1 session
- [ ] Manual test: 10 sessions
- [ ] Manual test: Partial failure simulation
- [ ] Manual test: Complete failure simulation
- [ ] Manual test: Run migration twice (idempotency)
- [ ] Manual test: Navigate away during migration
- [ ] Cross-browser test (Chrome, Safari)

### Documentation Checklist
- [ ] Update CLAUDE.md with migration button info
- [ ] Add migration entry to MASTER_STATUS_DASHBOARD.md
- [ ] Create user guide (if needed)
- [ ] Document edge cases in code comments

### Deployment Checklist
- [ ] Merge to main branch
- [ ] Deploy to production
- [ ] Monitor error logs for issues
- [ ] Collect user feedback
- [ ] Update documentation if issues found

---

## Future Considerations

### Version 2 Enhancements

#### 1. Migration History Tracking
Store migration runs in IndexedDB for audit trail:
```typescript
interface MigrationHistory {
  id: string
  timestamp: Date
  totalSessions: number
  successCount: number
  failedCount: number
  duration: number  // milliseconds
}
```

**Benefits:**
- Troubleshooting support
- Performance monitoring
- User reassurance (show last migration date)

---

#### 2. Selective Migration
Allow users to migrate specific date ranges:
```typescript
interface MigrationOptions {
  startDate?: string  // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
}
```

**Use Case:**
- User suspects specific sessions are incorrect
- Faster migration for large datasets

---

#### 3. Dry Run Mode
Preview migration results without saving:
```typescript
interface DryRunResult {
  sessionId: string
  oldSummary: SessionSummary
  newSummary: SessionSummary
  differences: string[]
}
```

**Benefits:**
- User confidence (see changes before applying)
- Debugging tool for support

---

#### 4. Automatic Migration Detection
Check if migration is needed on app load:
```typescript
useEffect(() => {
  const checkMigration = async () => {
    const needed = await isMigrationNeeded()
    if (needed) {
      // Show banner/toast suggesting migration
    }
  }
  checkMigration()
}, [])
```

**Implementation:**
```typescript
async function isMigrationNeeded(): Promise<boolean> {
  const sessions = await db.sessions.toArray()

  // Heuristic: if any summary is missing or old version
  return sessions.some(session =>
    !session.summary ||
    session.summary.version !== CURRENT_VERSION
  )
}
```

---

#### 5. Migration Cancellation
Allow user to stop mid-migration:
```typescript
const [abortController, setAbortController] = useState<AbortController | null>(null)

const cancelMigration = () => {
  abortController?.abort()
  setState(prev => ({ ...prev, status: 'cancelled' }))
}
```

**Considerations:**
- Partially migrated sessions remain updated (idempotent)
- User can resume by re-running

---

#### 6. Background Migration (Web Workers)
Offload calculation to web worker for better UI responsiveness:
```typescript
// migration-worker.ts
self.onmessage = async (e) => {
  const { sessionId, mainUserId } = e.data
  const summary = await calculateSessionSummary(sessionId, mainUserId)
  self.postMessage({ sessionId, summary })
}
```

**Benefits:**
- Non-blocking UI
- Better performance for large datasets

**Complexity:**
- Requires Dexie in worker context
- More complex error handling

---

#### 7. Migration Rollback
Store previous summaries for undo capability:
```typescript
interface MigrationBackup {
  sessionId: string
  previousSummary: SessionSummary
  migratedAt: Date
}
```

**Use Case:**
- User accidentally migrates
- Bug in new calculation logic

---

#### 8. Progress Persistence
Resume migration after interruption:
```typescript
// Store progress in localStorage
interface MigrationCheckpoint {
  sessionIds: string[]
  processedCount: number
  timestamp: Date
}

const saveCheckpoint = (checkpoint: MigrationCheckpoint) => {
  localStorage.setItem('migration-checkpoint', JSON.stringify(checkpoint))
}

const loadCheckpoint = (): MigrationCheckpoint | null => {
  const data = localStorage.getItem('migration-checkpoint')
  return data ? JSON.parse(data) : null
}
```

---

### Version 3: Automatic Background Migration

For future releases, consider automatic silent migration on app update:

```typescript
// App.tsx
useEffect(() => {
  const runAutoMigration = async () => {
    const currentVersion = await getAppVersion()
    const lastMigration = await getLastMigrationVersion()

    if (currentVersion > lastMigration) {
      // Run migration silently in background
      await runSessionMigration(MAIN_USER_ID)
      await setLastMigrationVersion(currentVersion)
    }
  }

  runAutoMigration()
}, [])
```

**Considerations:**
- Only for non-breaking changes
- Show progress notification (non-blocking)
- Fallback to manual migration if fails

---

## Summary

This design specification provides a complete blueprint for implementing the migration button feature. Key highlights:

**User Experience:**
- Clear, multi-state UI with progress feedback
- User-friendly error messages in Japanese
- Confirmation before destructive actions
- Safe to run multiple times

**Technical Implementation:**
- Idempotent migration logic
- Robust error handling (per-session and global)
- Performance-optimized for typical usage (<1000 sessions)
- Comprehensive logging for debugging

**Safety:**
- Preserves original data (only updates summary)
- Handles all edge cases gracefully
- Works offline (IndexedDB only)
- Compatible with future Capacitor app

**Maintainability:**
- Modular code structure (hook + component + utils)
- TypeScript types for all interfaces
- Follows project patterns (logger, errors)
- Extensive inline documentation

The implementation should take 4-6 hours for an experienced developer, including testing. No breaking changes to existing functionality.

---

**Document Status:** Ready for Implementation
**Next Step:** Create feature branch and begin implementation following the checklist above.
