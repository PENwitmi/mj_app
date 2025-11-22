import { describe, it, expect, beforeEach } from 'vitest';
import { db, initializeMainUser } from '@/lib/db';
import {
  getMainUser,
  getAllUsers,
  getRegisteredUsers,
  addUser,
  updateUser,
  archiveUser,
  restoreUser,
  getActiveUsers,
  getArchivedUsers,
} from '@/lib/db/users';
import { ValidationError, NotFoundError } from '@/lib/errors';

/**
 * 統合テスト: db/users.ts
 * ユーザー管理のデータベース操作テスト
 */

// ========================================
// Setup & Teardown
// ========================================

beforeEach(async () => {
  // 各テスト前にDBをクリア
  await db.users.clear();
  await db.sessions.clear();
  await db.hanchans.clear();
  await db.playerResults.clear();

  // メインユーザーを初期化
  await initializeMainUser();
});

// ========================================
// User Management Tests
// ========================================

describe('User Management', () => {
  it('TC-DB-USER-001: ユーザー追加（正常系）', async () => {
    const user = await addUser('テストユーザー1');

    expect(user.id).toBeDefined();
    expect(user.name).toBe('テストユーザー1');
    expect(user.isMainUser).toBe(false);
    expect(user.isArchived).toBe(false);
    expect(user.createdAt).toBeInstanceOf(Date);

    // DB確認
    const allUsers = await getAllUsers();
    expect(allUsers).toHaveLength(2); // メインユーザー + 新規ユーザー
  });

  it('TC-DB-USER-002: 重複名チェック（許可される）', async () => {
    await addUser('テストユーザー');
    const user2 = await addUser('テストユーザー');

    expect(user2.name).toBe('テストユーザー');

    // 同じ名前のユーザーが2人存在
    const allUsers = await getAllUsers();
    const duplicateNames = allUsers.filter(u => u.name === 'テストユーザー');
    expect(duplicateNames).toHaveLength(2);
  });

  it('TC-DB-USER-003: 空名前（ValidationError）', async () => {
    await expect(addUser('')).rejects.toThrow(ValidationError);
    await expect(addUser('   ')).rejects.toThrow(ValidationError);
  });

  it('TC-DB-USER-004: ユーザー更新', async () => {
    const user = await addUser('旧名前');
    const updatedUser = await updateUser(user.id, '新名前');

    expect(updatedUser.id).toBe(user.id);
    expect(updatedUser.name).toBe('新名前');

    // DB確認
    const dbUser = await db.users.get(user.id);
    expect(dbUser?.name).toBe('新名前');
  });

  it('TC-DB-USER-005: ユーザーアーカイブ（論理削除）', async () => {
    const user = await addUser('テストユーザー');

    await archiveUser(user.id);

    // アーカイブされたことを確認
    const archivedUser = await db.users.get(user.id);
    expect(archivedUser?.isArchived).toBe(true);
    expect(archivedUser?.archivedAt).toBeInstanceOf(Date);
  });

  it('TC-DB-USER-006: アーカイブ復元', async () => {
    const user = await addUser('テストユーザー');
    await archiveUser(user.id);

    await restoreUser(user.id);

    // 復元されたことを確認
    const restoredUser = await db.users.get(user.id);
    expect(restoredUser?.isArchived).toBe(false);
    expect(restoredUser?.archivedAt).toBeUndefined();
  });

  it('TC-DB-USER-007: getActiveUsers()（アーカイブ除外）', async () => {
    const user1 = await addUser('ユーザー1');
    const user2 = await addUser('ユーザー2');
    const user3 = await addUser('ユーザー3');

    // user2をアーカイブ
    await archiveUser(user2.id);

    const activeUsers = await getActiveUsers();

    // メインユーザー + user1 + user3 = 3人
    expect(activeUsers).toHaveLength(3);
    expect(activeUsers.find(u => u.id === user1.id)).toBeDefined();
    expect(activeUsers.find(u => u.id === user2.id)).toBeUndefined(); // アーカイブ済み
    expect(activeUsers.find(u => u.id === user3.id)).toBeDefined();
  });

  it('TC-DB-USER-008: getArchivedUsers()', async () => {
    const user1 = await addUser('ユーザー1');
    const user2 = await addUser('ユーザー2');

    await archiveUser(user1.id);

    const archivedUsers = await getArchivedUsers();

    expect(archivedUsers).toHaveLength(1);
    expect(archivedUsers[0].id).toBe(user1.id);
  });

  it('TC-DB-USER-009: メインユーザー取得（固定ID）', async () => {
    const mainUser = await getMainUser();

    expect(mainUser).toBeDefined();
    expect(mainUser?.id).toBe('main-user-fixed-id');
    expect(mainUser?.name).toBe('自分');
    expect(mainUser?.isMainUser).toBe(true);
    expect(mainUser?.isArchived).toBe(false);
  });

  it('TC-DB-USER-010: メインユーザー重複作成防止', async () => {
    // 既にbeforeEachで初期化済み
    const mainUser1 = await getMainUser();

    // 再度初期化しても重複作成されない
    await initializeMainUser();
    const mainUser2 = await getMainUser();

    expect(mainUser1?.id).toBe(mainUser2?.id);
    expect(mainUser1?.id).toBe('main-user-fixed-id');

    // 全ユーザー数確認（メインユーザーは1人のみ）
    const allUsers = await getAllUsers();
    const mainUsers = allUsers.filter(u => u.isMainUser);
    expect(mainUsers).toHaveLength(1);
  });
});

// ========================================
// Additional Edge Case Tests
// ========================================

describe('User Management - Edge Cases', () => {
  it('存在しないユーザーの更新（NotFoundError）', async () => {
    await expect(updateUser('non-existent-id', '新名前')).rejects.toThrow(NotFoundError);
  });

  it('存在しないユーザーのアーカイブ（NotFoundError）', async () => {
    await expect(archiveUser('non-existent-id')).rejects.toThrow(NotFoundError);
  });

  it('存在しないユーザーの復元（NotFoundError）', async () => {
    await expect(restoreUser('non-existent-id')).rejects.toThrow(NotFoundError);
  });

  it('メインユーザーのアーカイブ試行（ValidationError）', async () => {
    const mainUser = await getMainUser();
    expect(mainUser).toBeDefined();

    await expect(archiveUser(mainUser!.id)).rejects.toThrow(ValidationError);
  });

  it('既にアクティブなユーザーの復元（ValidationError）', async () => {
    const user = await addUser('テストユーザー');

    // アーカイブしていない状態で復元試行
    await expect(restoreUser(user.id)).rejects.toThrow(ValidationError);
  });

  it('getRegisteredUsers()（メインユーザー除外、アーカイブ除外）', async () => {
    const user1 = await addUser('ユーザー1');
    const user2 = await addUser('ユーザー2');
    await archiveUser(user2.id);

    const registeredUsers = await getRegisteredUsers();

    // user1のみ（メインユーザーとアーカイブ済みユーザーは除外）
    expect(registeredUsers).toHaveLength(1);
    expect(registeredUsers[0].id).toBe(user1.id);
    expect(registeredUsers[0].isMainUser).toBe(false);
    expect(registeredUsers[0].isArchived).toBe(false);
  });

  it('長いユーザー名（20文字以上）', async () => {
    const longName = 'あ'.repeat(30); // 30文字
    const user = await addUser(longName);

    expect(user.name).toBe(longName);
    expect(user.name.length).toBe(30);
  });

  it('特殊文字含む名前', async () => {
    const specialName = 'Test<User>@123#$%';
    const user = await addUser(specialName);

    expect(user.name).toBe(specialName);
  });
});
