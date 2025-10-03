import { useState, useEffect } from 'react'
import { getMainUser, getRegisteredUsers, addUser, deleteUser, updateUser } from '@/lib/db-utils'
import type { User } from '@/lib/db'

/**
 * ユーザー一覧管理カスタムフック
 * メインユーザーと登録ユーザー一覧を取得・管理
 */
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const main = await getMainUser()
        const registered = await getRegisteredUsers()
        setMainUser(main ?? null)
        setUsers(registered)
      } catch (error) {
        console.error('Failed to load users:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  /**
   * 新規ユーザーを追加
   * @param name - ユーザー名
   * @returns 作成されたユーザー
   */
  const addNewUser = async (name: string): Promise<User> => {
    const newUser = await addUser(name)
    setUsers(prev => [...prev, newUser])
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
      // 登録ユーザーの場合
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u))
    }

    return updatedUser
  }

  /**
   * ユーザーを削除（メインユーザーは削除不可）
   * @param userId - ユーザーID
   */
  const removeUser = async (userId: string): Promise<void> => {
    await deleteUser(userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  return {
    mainUser,
    users,
    loading,
    addNewUser,
    editUser,
    removeUser,
  }
}
