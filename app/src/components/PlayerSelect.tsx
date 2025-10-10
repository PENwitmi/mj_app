import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select'
import { NewPlayerDialog } from './NewPlayerDialog'
import type { User } from '@/lib/db-utils'

// 特殊な値定義
const SPECIAL_VALUES = {
  DEFAULT: '__default__',     // デフォルト名のまま（集計対象外）
  NEW_PLAYER: '__new__'       // 新規プレイヤー登録
} as const

interface PlayerSelectProps {
  value: string              // userId or SPECIAL_VALUES
  playerName: string         // 表示用
  onChange: (userId: string | null, playerName: string) => void
  position: number           // プレイヤー位置（1,2,3,4）
  mainUser: User | null
  users: User[]
  onAddUser: (name: string) => Promise<User>
  excludeMainUser?: boolean  // メインユーザーを選択肢から除外
}

/**
 * プレイヤー選択Select
 * メインユーザー、登録済みユーザー、デフォルト名、新規登録を選択可能
 */
export function PlayerSelect({
  value,
  playerName: _playerName, // eslint-disable-line @typescript-eslint/no-unused-vars
  onChange,
  position,
  mainUser,
  users,
  onAddUser,
  excludeMainUser = false,
}: PlayerSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleValueChange = (newValue: string) => {
    if (newValue === SPECIAL_VALUES.NEW_PLAYER) {
      // 新規プレイヤー登録ダイアログを表示
      setDialogOpen(true)
      return
    }

    if (newValue === SPECIAL_VALUES.DEFAULT) {
      // デフォルト名（userId = null）
      onChange(null, `user${position}`)
      return
    }

    // メインユーザーまたは登録済みユーザーを選択
    if (newValue === mainUser?.id) {
      onChange(mainUser.id, mainUser.name)
      return
    }

    const selectedUser = users.find(u => u.id === newValue)
    if (selectedUser) {
      onChange(selectedUser.id, selectedUser.name)
    }
  }

  const handleNewPlayerSave = async (name: string): Promise<User> => {
    const newUser = await onAddUser(name)
    onChange(newUser.id, newUser.name)
    return newUser
  }

  // 現在の選択値を決定
  const currentValue = value === null ? SPECIAL_VALUES.DEFAULT : value

  return (
    <>
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full [&>svg]:hidden">
          <SelectValue placeholder="プレイヤーを選択" />
        </SelectTrigger>
        <SelectContent>
          {/* メインユーザー */}
          {mainUser && !excludeMainUser && (
            <>
              <SelectItem value={mainUser.id}>
                自分
              </SelectItem>
              <SelectSeparator />
            </>
          )}

          {/* 登録済みユーザー */}
          {users.map(user => (
            <SelectItem key={user.id} value={user.id}>
              {user.name}
            </SelectItem>
          ))}

          {/* デフォルト名 */}
          {users.length > 0 && <SelectSeparator />}
          <SelectItem value={SPECIAL_VALUES.DEFAULT}>
            user{position}
          </SelectItem>

          {/* 新規登録 */}
          <SelectSeparator />
          <SelectItem value={SPECIAL_VALUES.NEW_PLAYER}>
            ＋ 新しいプレイヤーを登録
          </SelectItem>
        </SelectContent>
      </Select>

      {/* 新規プレイヤー登録ダイアログ */}
      <NewPlayerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleNewPlayerSave}
        existingUsers={[...(mainUser ? [mainUser] : []), ...users]}
      />
    </>
  )
}
