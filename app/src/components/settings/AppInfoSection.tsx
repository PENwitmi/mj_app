import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { User } from '@/lib/db'

// vite.config.tsで定義
declare const __APP_VERSION__: string

interface AppInfoSectionProps {
  mainUser: User | null
}

/**
 * アプリ情報セクション
 * - バージョン表示
 * - ユーザーID表示（タップでコピー）
 */
export function AppInfoSection({ mainUser }: AppInfoSectionProps) {
  const handleCopyUserId = async () => {
    if (mainUser?.id) {
      await navigator.clipboard.writeText(mainUser.id)
      toast.success('ユーザーIDをコピーしました')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📱</span>
          アプリ情報
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">バージョン</span>
          <span>{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">ユーザーID</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyUserId}
            className="font-mono text-xs h-auto py-1 px-2"
          >
            {mainUser?.id ?? '-'}
            <Copy className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
