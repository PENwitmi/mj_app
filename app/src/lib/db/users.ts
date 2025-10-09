import { db, type User } from '../db';
import { logger } from '../logger';
import { DatabaseError, ValidationError, NotFoundError } from '../errors';

// ========================================
// User Functions
// ========================================

/**
 * メインユーザーを取得
 */
export async function getMainUser(): Promise<User | undefined> {
  try {
    logger.debug('メインユーザーを取得開始', { context: 'db.users.getMainUser' });
    const allUsers = await db.users.toArray();
    const mainUser = allUsers.find(user => user.isMainUser);

    if (mainUser) {
      logger.debug('メインユーザー取得成功', {
        context: 'db.users.getMainUser',
        data: { userId: mainUser.id }
      });
    } else {
      logger.warn('メインユーザーが見つかりません', { context: 'db.users.getMainUser' });
    }

    return mainUser;
  } catch (err) {
    const error = new DatabaseError('メインユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.users.getMainUser',
      error
    });
    throw error;
  }
}

/**
 * 全ユーザーを取得
 */
export async function getAllUsers(): Promise<User[]> {
  return await db.users.toArray();
}

/**
 * 登録ユーザーを取得（アクティブのみ、メインユーザーを除く）
 */
export async function getRegisteredUsers(): Promise<User[]> {
  const allUsers = await db.users.toArray();
  return allUsers.filter(user => !user.isMainUser && !user.isArchived);
}

/**
 * 新規ユーザーを追加
 */
export async function addUser(name: string): Promise<User> {
  // バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, {
      context: 'db.users.addUser',
      error
    });
    throw error;
  }

  try {
    logger.debug('ユーザー追加開始', {
      context: 'db.users.addUser',
      data: { userName: name }
    });

    const user: User = {
      id: crypto.randomUUID(),
      name,
      isMainUser: false,
      isArchived: false,
      createdAt: new Date()
    };

    await db.users.add(user);

    logger.info('ユーザー追加成功', {
      context: 'db.users.addUser',
      data: { userId: user.id, userName: user.name }
    });

    return user;
  } catch (err) {
    const error = new DatabaseError('ユーザーの追加に失敗しました', {
      userName: name,
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.users.addUser',
      error
    });
    throw error;
  }
}

/**
 * ユーザー名を更新
 */
export async function updateUser(userId: string, name: string): Promise<User> {
  // バリデーション
  if (!name.trim()) {
    const error = new ValidationError('ユーザー名が空です', 'name');
    logger.error(error.message, {
      context: 'db.users.updateUser',
      error
    });
    throw error;
  }

  try {
    logger.debug('ユーザー名更新開始', {
      context: 'db.users.updateUser',
      data: { userId, newName: name }
    });

    // ユーザー情報を取得
    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db.users.updateUser',
        error
      });
      throw error;
    }

    // ユーザー名を更新
    await db.users.update(userId, { name: name.trim() });

    // 更新後のユーザー情報を取得
    const updatedUser = await db.users.get(userId);
    if (!updatedUser) {
      throw new DatabaseError('更新後のユーザー情報取得に失敗しました');
    }

    logger.info('ユーザー名更新成功', {
      context: 'db.users.updateUser',
      data: { userId, oldName: user.name, newName: updatedUser.name }
    });

    return updatedUser;
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザー名の更新に失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db.users.updateUser',
      error
    });
    throw error;
  }
}

/**
 * ユーザーをアーカイブ（論理削除）
 * @param userId - アーカイブするユーザーID
 */
export async function archiveUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザーアーカイブ開始', {
      context: 'db.users.archiveUser',
      data: { userId }
    });

    // ユーザー情報を取得
    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db.users.archiveUser',
        error
      });
      throw error;
    }

    // メインユーザーのアーカイブを防止
    if (user.isMainUser) {
      const error = new ValidationError('メインユーザーはアーカイブできません', 'userId');
      logger.error(error.message, {
        context: 'db.users.archiveUser',
        error,
        data: { userId }
      });
      throw error;
    }

    // アーカイブフラグを設定
    await db.users.update(userId, {
      isArchived: true,
      archivedAt: new Date()
    });

    logger.info('ユーザーアーカイブ成功', {
      context: 'db.users.archiveUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーのアーカイブに失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db.users.archiveUser',
      error
    });
    throw error;
  }
}

/**
 * アーカイブ済みユーザーを復元
 * @param userId - 復元するユーザーID
 */
export async function restoreUser(userId: string): Promise<void> {
  try {
    logger.debug('ユーザー復元開始', {
      context: 'db.users.restoreUser',
      data: { userId }
    });

    const user = await db.users.get(userId);
    if (!user) {
      const error = new NotFoundError('ユーザーが見つかりません', userId);
      logger.error(error.message, {
        context: 'db.users.restoreUser',
        error
      });
      throw error;
    }

    if (!user.isArchived) {
      const error = new ValidationError('ユーザーは既にアクティブです', 'userId');
      logger.error(error.message, {
        context: 'db.users.restoreUser',
        error,
        data: { userId }
      });
      throw error;
    }

    await db.users.update(userId, {
      isArchived: false,
      archivedAt: undefined
    });

    logger.info('ユーザー復元成功', {
      context: 'db.users.restoreUser',
      data: { userId, userName: user.name }
    });
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      throw err;
    }
    const error = new DatabaseError('ユーザーの復元に失敗しました', { originalError: err });
    logger.error(error.message, {
      context: 'db.users.restoreUser',
      error
    });
    throw error;
  }
}

/**
 * アクティブユーザーのみ取得
 */
export async function getActiveUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => !u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アクティブユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.users.getActiveUsers',
      error
    });
    throw error;
  }
}

/**
 * アーカイブ済みユーザーのみ取得
 */
export async function getArchivedUsers(): Promise<User[]> {
  try {
    const allUsers = await db.users.toArray();
    return allUsers.filter(u => u.isArchived);
  } catch (err) {
    const error = new DatabaseError('アーカイブ済みユーザーの取得に失敗しました', {
      originalError: err
    });
    logger.error(error.message, {
      context: 'db.users.getArchivedUsers',
      error
    });
    throw error;
  }
}

/**
 * @deprecated archiveUserを使用してください
 * ユーザーを削除（非推奨）
 */
export async function deleteUser(userId: string): Promise<void> {
  logger.warn('deleteUserは非推奨です。archiveUserを使用してください', {
    context: 'db.users.deleteUser',
    data: { userId }
  });

  // 内部的にarchiveUserを呼び出す
  return archiveUser(userId);
}
