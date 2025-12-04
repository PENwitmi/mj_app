import { useState, useEffect } from 'react'
import {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  type TemplateFormData
} from '@/lib/db-utils'
import type { Template } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * テンプレート一覧管理カスタムフック
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  /**
   * テンプレート一覧をDBから再取得して状態を更新
   */
  const loadTemplates = async () => {
    try {
      const data = await getAllTemplates()
      setTemplates(data)
    } catch (error) {
      logger.error('テンプレート一覧の取得に失敗しました', {
        context: 'useTemplates.loadTemplates',
        error: error as Error
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()

    // 他のコンポーネントからのテンプレート追加を検知してリフレッシュ
    const handleTemplateCreated = () => {
      loadTemplates()
    }
    window.addEventListener('template-created', handleTemplateCreated)
    return () => {
      window.removeEventListener('template-created', handleTemplateCreated)
    }
  }, [])

  /**
   * 新規テンプレートを追加
   * @param data テンプレートデータ
   * @returns 作成されたテンプレート
   */
  const addTemplate = async (data: TemplateFormData): Promise<Template> => {
    const newTemplate = await createTemplate(data)
    setTemplates(prev => [newTemplate, ...prev]) // 先頭に追加（作成日時降順）
    return newTemplate
  }

  /**
   * テンプレートを更新
   * @param id テンプレートID
   * @param data 更新データ
   * @returns 更新されたテンプレート
   */
  const editTemplate = async (id: string, data: Partial<TemplateFormData>): Promise<Template> => {
    const updatedTemplate = await updateTemplate(id, data)
    setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t))
    return updatedTemplate
  }

  /**
   * テンプレートを削除
   * @param id テンプレートID
   */
  const removeTemplate = async (id: string): Promise<void> => {
    await deleteTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return {
    templates,
    loading,
    addTemplate,
    editTemplate,
    removeTemplate,
    refreshTemplates: loadTemplates
  }
}
