import { db, type Template, type GameMode, type UmaRule, type Session, type Hanchan, type PlayerResult } from '../db';
import { logger } from '../logger';
import { DatabaseError, ValidationError, NotFoundError } from '../errors';

// ========================================
// Template Types
// ========================================

/**
 * テンプレート作成・更新用のデータ型（id, createdAt, updatedAt は自動生成）
 */
export interface TemplateFormData {
  name: string;
  gameMode: GameMode;
  playerIds: string[];
  rate: number;
  umaValue: number;
  chipRate: number;
  umaRule: UmaRule;
}

// ========================================
// Template CRUD Functions
// ========================================

/**
 * テンプレート作成
 * @param data テンプレートデータ
 * @returns 作成されたテンプレート
 */
export async function createTemplate(data: TemplateFormData): Promise<Template> {
  // バリデーション
  if (!data.name.trim()) {
    throw new ValidationError('テンプレート名を入力してください');
  }
  if (data.name.length > 50) {
    throw new ValidationError('テンプレート名は50文字以内で入力してください');
  }
  if (data.rate < 1) {
    throw new ValidationError('レートは1以上で入力してください');
  }
  if (data.umaValue < 1) {
    throw new ValidationError('ウマ値は1以上で入力してください');
  }
  if (data.chipRate < 1) {
    throw new ValidationError('チップレートは1以上で入力してください');
  }

  const now = new Date();
  const template: Template = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    gameMode: data.gameMode,
    playerIds: data.playerIds,
    rate: data.rate,
    umaValue: data.umaValue,
    chipRate: data.chipRate,
    umaRule: data.umaRule,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.templates.add(template);

    logger.info('テンプレート作成完了', {
      context: 'templates.createTemplate',
      data: { templateId: template.id, name: template.name }
    });

    return template;
  } catch (error) {
    const dbError = new DatabaseError('テンプレートの作成に失敗しました', {
      originalError: error
    });
    logger.error(dbError.message, {
      context: 'templates.createTemplate',
      error: dbError
    });
    throw dbError;
  }
}

/**
 * 全テンプレート取得（作成日時降順）
 * @returns テンプレート配列
 */
export async function getAllTemplates(): Promise<Template[]> {
  try {
    const templates = await db.templates
      .orderBy('createdAt')
      .reverse()
      .toArray();

    logger.debug('テンプレート一覧取得', {
      context: 'templates.getAllTemplates',
      data: { count: templates.length }
    });

    return templates;
  } catch (error) {
    const dbError = new DatabaseError('テンプレート一覧の取得に失敗しました', {
      originalError: error
    });
    logger.error(dbError.message, {
      context: 'templates.getAllTemplates',
      error: dbError
    });
    throw dbError;
  }
}

/**
 * テンプレート取得（単一）
 * @param id テンプレートID
 * @returns テンプレート or undefined
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const template = await db.templates.get(id);

    logger.debug('テンプレート取得', {
      context: 'templates.getTemplate',
      data: { templateId: id, found: !!template }
    });

    return template;
  } catch (error) {
    const dbError = new DatabaseError('テンプレートの取得に失敗しました', {
      originalError: error
    });
    logger.error(dbError.message, {
      context: 'templates.getTemplate',
      error: dbError
    });
    throw dbError;
  }
}

/**
 * テンプレート更新
 * @param id テンプレートID
 * @param data 更新データ
 * @returns 更新されたテンプレート
 */
export async function updateTemplate(
  id: string,
  data: Partial<TemplateFormData>
): Promise<Template> {
  // バリデーション
  if (data.name !== undefined) {
    if (!data.name.trim()) {
      throw new ValidationError('テンプレート名を入力してください');
    }
    if (data.name.length > 50) {
      throw new ValidationError('テンプレート名は50文字以内で入力してください');
    }
  }
  if (data.rate !== undefined && data.rate < 1) {
    throw new ValidationError('レートは1以上で入力してください');
  }
  if (data.umaValue !== undefined && data.umaValue < 1) {
    throw new ValidationError('ウマ値は1以上で入力してください');
  }
  if (data.chipRate !== undefined && data.chipRate < 1) {
    throw new ValidationError('チップレートは1以上で入力してください');
  }

  try {
    const existing = await db.templates.get(id);
    if (!existing) {
      throw new NotFoundError('テンプレートが見つかりません');
    }

    const updateData: Partial<Template> = {
      ...data,
      name: data.name?.trim(),
      updatedAt: new Date(),
    };

    await db.templates.update(id, updateData);

    const updated = await db.templates.get(id);
    if (!updated) {
      throw new DatabaseError('テンプレートの更新後の取得に失敗しました');
    }

    logger.info('テンプレート更新完了', {
      context: 'templates.updateTemplate',
      data: { templateId: id, name: updated.name }
    });

    return updated;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    const dbError = new DatabaseError('テンプレートの更新に失敗しました', {
      originalError: error
    });
    logger.error(dbError.message, {
      context: 'templates.updateTemplate',
      error: dbError
    });
    throw dbError;
  }
}

/**
 * テンプレート削除
 * @param id テンプレートID
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    const existing = await db.templates.get(id);
    if (!existing) {
      throw new NotFoundError('テンプレートが見つかりません');
    }

    await db.templates.delete(id);

    logger.info('テンプレート削除完了', {
      context: 'templates.deleteTemplate',
      data: { templateId: id, name: existing.name }
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    const dbError = new DatabaseError('テンプレートの削除に失敗しました', {
      originalError: error
    });
    logger.error(dbError.message, {
      context: 'templates.deleteTemplate',
      error: dbError
    });
    throw dbError;
  }
}

// ========================================
// Issue #9 用ヘルパー関数
// ========================================

/**
 * セッションからテンプレートを作成
 * @param session セッション
 * @param hanchans 半荘配列（プレイヤーID取得用）
 * @param name テンプレート名
 * @returns 作成されたテンプレート
 */
export async function createTemplateFromSession(
  session: Session,
  hanchans: Array<Hanchan & { players: PlayerResult[] }>,
  name: string
): Promise<Template> {
  // プレイヤーIDを抽出（最初の半荘から、重複排除、順序保持）
  const playerIds = extractUniquePlayerIds(hanchans);

  const templateData: TemplateFormData = {
    name,
    gameMode: session.mode,
    playerIds,
    rate: session.rate,
    umaValue: session.umaValue,
    chipRate: session.chipRate,
    umaRule: session.umaRule,
  };

  return createTemplate(templateData);
}

/**
 * 半荘データからユニークなプレイヤーIDを抽出
 * @param hanchans 半荘配列
 * @returns ユニークなプレイヤーID配列（順序保持）
 */
function extractUniquePlayerIds(
  hanchans: Array<Hanchan & { players: PlayerResult[] }>
): string[] {
  if (hanchans.length === 0) return [];

  // 最初の半荘のプレイヤー構成を使用（position順でソート）
  const players = [...hanchans[0].players].sort((a, b) => a.position - b.position);

  return players
    .filter(p => p.userId !== null)
    .map(p => p.userId!);
}
