import { useState, useEffect } from 'react'
import {
  getMainUser,
  getRegisteredUsers,
  getArchivedUsers,
  addUser,
  archiveUser,
  restoreUser,
  updateUser
} from '@/lib/db-utils'
import type { User } from '@/lib/db-utils'
import { logger } from '@/lib/logger'

/**
 * ユーザー一覧管理カスタムフック
 * メインユーザー、アクティブユーザー、アーカイブ済みユーザーを管理
 */
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null)
  const [activeUsers, setActiveUsers] = useState<User[]>([])
  const [archivedUsers, setArchivedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * ユーザー一覧をDBから再取得して状態を更新
   * 初期化後やデータ変更時に呼び出す
   */
  const loadUsers = async () => {
    try {
      const main = await getMainUser()
      const active = await getRegisteredUsers()  // アクティブのみ
      const archived = await getArchivedUsers()

      setMainUser(main ?? null)
      setActiveUsers(active)
      setArchivedUsers(archived)
    } catch (error) {
      logger.error('ユーザー一覧の取得に失敗しました', {
        context: 'useUsers.loadUsers',
        error: error as Error
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  /**
   * 新規ユーザーを追加
   * @param name - ユーザー名
   * @returns 作成されたユーザー
   */
  const addNewUser = async (name: string): Promise<User> => {
    const newUser = await addUser(name)
    setActiveUsers(prev => [...prev, newUser])
    return newUser
  }

  /**
   * ユーザー名を更新
   * @param userId - ユーザーID
   * @param name - 新しい名前
   */
  const editUser = async (userId: string, name: string): Promise<User> => {
    const updatedUser = await updateUser(userId, name)

    // メインユーザーの場合
    if (updatedUser.isMainUser) {
      setMainUser(updatedUser)
    } else {
      // 登録ユーザーの場合（アクティブ or アーカイブ）
      setActiveUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
      setArchivedUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
    }

    return updatedUser
  }

  /**
   * ユーザーをアーカイブ（論理削除）
   * @param userId - ユーザーID
   */
  const archiveUserAction = async (userId: string): Promise<void> => {
    await archiveUser(userId)

    // アクティブから削除、アーカイブに追加
    const user = activeUsers.find(u => u.id === userId)
    if (user) {
      setActiveUsers(prev => prev.filter(u => u.id !== userId))
      setArchivedUsers(prev => [...prev, { ...user, isArchived: true, archivedAt: new Date() }])
    }
  }

  /**
   * アーカイブ済みユーザーを復元
   * @param userId - ユーザーID
   */
  const restoreUserAction = async (userId: string): Promise<void> => {
    await restoreUser(userId)

    // アーカイブから削除、アクティブに追加
    const user = archivedUsers.find(u => u.id === userId)
    if (user) {
      setArchivedUsers(prev => prev.filter(u => u.id !== userId))
      setActiveUsers(prev => [...prev, { ...user, isArchived: false, archivedAt: undefined }])
    }
  }

  return {
    mainUser,
    activeUsers,      // 旧usersをactiveUsersに変更
    archivedUsers,    // 新規追加
    loading,
    addNewUser,
    editUser,
    archiveUser: archiveUserAction,  // 旧removeUserをarchiveUserに変更
    restoreUser: restoreUserAction,  // 新規追加
    refreshUsers: loadUsers,  // 手動リフレッシュ関数
  }
}
