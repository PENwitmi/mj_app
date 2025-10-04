Last updated: 2025-10-05

# UI実装パターン

## コンポーネント設計原則

### 1. Radix UI + Tailwind CSS パターン
- **基底**: Radix UI (unstyled, accessible)
- **スタイル**: Tailwind CSS v4 (utility-first)
- **バリアント**: class-variance-authority (cva)
- **マージ**: clsx + tailwind-merge (cn関数)

### 2. コンポーネント構造
```typescript
// 基本パターン (Button.tsx例)
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: { default: "...", destructive: "...", outline: "..." },
      size: { default: "...", sm: "...", lg: "..." }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

## InputTab実装パターン

### 1. 状態管理
```typescript
// セッション設定
const [settings, setSettings] = useState<SessionSettings>({
  date: new Date().toISOString().split('T')[0],
  rate: 30,
  umaValue: 10,
  chipRate: 100,
  umaRule: getDefaultUmaRule() // localStorage
});

// 半荘データ
const [hanchans, setHanchans] = useState<Hanchan[]>([]);

// モード・プレイヤー数
const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
const [playerCount, setPlayerCount] = useState<number>(0);
```

### 2. 自動計算ロジック
```typescript
// ゼロサム原則による自動計算（初回のみ）
if (!currentHanchan.autoCalculated) {
  const activePlayers = currentHanchan.players.filter(p => !p.isSpectator);
  const expectedCount = selectedMode === '4-player' ? 4 : 3;
  const filledCount = activePlayers.filter(p => p.score !== null).length;
  
  // N-1人入力済み → 最後の1人を自動計算
  if (filledCount === expectedCount - 1) {
    const lastPlayerIdx = activePlayers.findIndex(p => p.score === null);
    if (lastPlayerIdx !== -1) {
      const autoScore = calculateAutoScore(currentHanchan.players);
      currentHanchan.players[lastPlayerIdx].score = autoScore;
      currentHanchan.autoCalculated = true;
    }
  }
}
```

### 3. ウママーク自動割り当て
```typescript
// 点数順位でソート → ルールに応じて割り当て
const assignUmaMarks = (
  players: PlayerResult[], 
  mode: GameMode, 
  umaRule: UmaRule
): UmaMark[] => {
  const playersWithIndex = players
    .map((p, idx) => ({ player: p, index: idx }))
    .filter(({ player }) => !player.isSpectator && player.score !== null)
    .sort((a, b) => (b.player.score ?? 0) - (a.player.score ?? 0));
  
  const umaMarks: UmaMark[] = players.map(() => '');
  
  // 2位マイナス判定
  const secondPlaceScore = playersWithIndex[1]?.player.score ?? 0;
  const isSecondMinus = umaRule === 'second-minus' && secondPlaceScore < 0;
  
  if (mode === '4-player') {
    if (isSecondMinus) {
      // 1位→○○○、2位→無印、3位→✗、4位→✗✗
      umaMarks[playersWithIndex[0].index] = '○○○';
      umaMarks[playersWithIndex[1].index] = '';
      umaMarks[playersWithIndex[2].index] = '✗';
      umaMarks[playersWithIndex[3].index] = '✗✗';
    } else {
      // 1位→○○、2位→○、3位→✗、4位→✗✗
      umaMarks[playersWithIndex[0].index] = '○○';
      umaMarks[playersWithIndex[1].index] = '○';
      umaMarks[playersWithIndex[2].index] = '✗';
      umaMarks[playersWithIndex[3].index] = '✗✗';
    }
  }
  // 3人打ちも同様...
  
  return umaMarks;
};
```

### 4. リアルタイム更新パターン
```typescript
// onChange: リアルタイム表示更新
onChange={(e) => {
  const newHanchans = [...hanchans];
  const hanchanIdx = hanchans.findIndex(h => h.hanchanNumber === hanchan.hanchanNumber);
  newHanchans[hanchanIdx].players[playerIdx].score = 
    e.target.value === '' ? null : Number(e.target.value);
  setHanchans(newHanchans);
}}

// onBlur: 自動計算・ウママーク割り当て
onBlur={() => {
  const newHanchans = [...hanchans];
  // ... 自動計算ロジック
  // ... ウママーク割り当て
  setHanchans(newHanchans);
}}
```

### 5. 集計計算
```typescript
const calculatePlayerTotals = (
  playerIndex: number,
  hanchans: Hanchan[],
  settings: SessionSettings
): PlayerTotals => {
  let scoreTotal = 0;
  let umaTotal = 0;
  let chips = 0;
  let parlorFee = 0;
  
  hanchans.forEach((hanchan) => {
    const player = hanchan.players[playerIndex];
    if (!player.isSpectator && player.score !== null) {
      scoreTotal += player.score;
      umaTotal += umaMarkToValue(player.umaMark);
    }
    chips = player.chips; // 最後の値
    parlorFee = player.parlorFee; // 最後の値
  });
  
  const subtotal = scoreTotal + umaTotal * settings.umaValue;
  const payout = subtotal * settings.rate + chips * settings.chipRate;
  const finalPayout = payout - parlorFee;
  
  return { scoreTotal, umaTotal, subtotal, chips, payout, parlorFee, finalPayout };
};
```

## PlayerSelect実装パターン

### 1. カスタムドロップダウン
```typescript
<Select value={value} onValueChange={handleChange}>
  <SelectTrigger>
    <SelectValue>{displayText}</SelectValue>
  </SelectTrigger>
  <SelectContent>
    {/* 仮名入力トリガー */}
    <SelectItem value="__temp__">仮名で入力</SelectItem>
    
    {/* 新規登録トリガー */}
    <SelectItem value="__new__">+ 新規登録</SelectItem>
    
    {/* 登録ユーザー一覧 */}
    {users.map(user => (
      <SelectItem key={user.id} value={user.id}>
        {user.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 2. 条件分岐処理
```typescript
const handleChange = (newValue: string) => {
  if (newValue === '__temp__') {
    setIsEditingTempName(true);
    onChange(null, ''); // 集計対象外
  } else if (newValue === '__new__') {
    setDialogOpen(true); // 新規登録ダイアログ
  } else {
    const user = users.find(u => u.id === newValue);
    onChange(newValue, user?.name || '');
    setIsEditingTempName(false);
  }
};
```

### 3. インライン編集
```typescript
{isEditingTempName ? (
  <Input
    value={tempName}
    onChange={(e) => {
      const name = e.target.value;
      setTempName(name);
      onChange(null, name); // userId=null（集計対象外）
    }}
    onBlur={() => setIsEditingTempName(false)}
    autoFocus
  />
) : (
  <Select ... />
)}
```

## useUsers フック

### 1. データ取得・管理
```typescript
export function useUsers() {
  const [mainUser, setMainUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const main = await getMainUser();
        const registered = await getRegisteredUsers();
        setMainUser(main ?? null);
        setUsers(registered);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);
  
  // CRUD操作
  const addNewUser = async (name: string) => { ... };
  const editUser = async (userId: string, name: string) => { ... };
  const removeUser = async (userId: string) => { ... };
  
  return { mainUser, users, loading, addNewUser, editUser, removeUser };
}
```

### 2. 楽観的更新
```typescript
const addNewUser = async (name: string): Promise<User> => {
  const newUser = await addUser(name);
  setUsers(prev => [...prev, newUser]); // 即座にUI更新
  return newUser;
};

const removeUser = async (userId: string): Promise<void> => {
  await deleteUser(userId);
  setUsers(prev => prev.filter(u => u.id !== userId)); // 即座にUI更新
};
```

## レスポンシブデザインパターン

### 1. 固定ヘッダー・フッター
```typescript
<div className="flex flex-col gap-2 h-full">
  {/* 固定ヘッダー */}
  <Card className="py-0 shrink-0">...</Card>
  
  {/* スクロール可能エリア */}
  <Card className="py-0 h-[calc(100vh-390px)] overflow-hidden shrink-0">
    <CardContent className="p-2 flex flex-col h-full">
      <div className="flex-1 overflow-auto">...</div>
    </CardContent>
  </Card>
  
  {/* 固定フッター（集計） */}
  <div className="fixed bottom-12 left-0 right-0 px-2 pb-2 z-20">...</div>
</div>
```

### 2. テーブル固定ヘッダー
```typescript
<table className="w-full border-collapse text-xs table-fixed">
  <thead className="sticky top-0 z-10 bg-white">...</thead>
  <tbody>...</tbody>
</table>
```

## HistoryTab実装パターン（Phase 4）

### 1. リアルタイムDB監視（useSessions）
```typescript
export function useSessions() {
  const [sessions, setSessions] = useState<SessionWithSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dexie liveQuery でリアルタイム監視
    const subscription = liveQuery(() =>
      db.sessions.orderBy('date').reverse().toArray()
    ).subscribe({
      next: (data) => {
        setSessions(data as SessionWithSummary[]);
        setLoading(false);
      },
      error: (err) => console.error('Failed to load sessions:', err)
    });

    return () => subscription.unsubscribe();
  }, []);

  // ... deleteSession等
}
```

### 2. サマリー事前計算の活用
```typescript
// 保存時: サマリーを事前計算
await saveSessionWithSummary(sessionSaveData);

// 読み込み時: 保存済みサマリーを優先使用
const summary = session.summary || calculateSessionSummary(session, hanchansWithDetails);

// パフォーマンス: 300-800倍高速化達成
// DB読み取り: 95%削減（2,350 → 100 レコード想定）
```

### 3. SessionDetailDialog実装
```typescript
// position順でプレイヤー結果を表示
const playerResults = await getPlayerResultsByHanchan(hanchanId);
// → position順にソート済み（InputTabでの列順を保持）

// プレイヤー別統計を表示
const stats = getPlayerSessionStats(playerIndex, hanchans, settings);
// → 着順内訳、収支、チップ合計等
```

## ベストプラクティス

1. **状態の不変性**: スプレッド演算子で新しい配列・オブジェクト作成
2. **条件付きレンダリング**: 三項演算子 or 論理AND
3. **key属性**: 一意のID使用（配列インデックス避ける）
4. **className合成**: cn()関数使用
5. **forwardRef**: Radix UIコンポーネントで必須
6. **controlled components**: value + onChange パターン
7. **localStorage**: デフォルト値の永続化
8. **リアルタイムDB監視**: Dexie liveQuery + useEffect + subscription cleanup
9. **パフォーマンス最適化**: サマリー事前計算、DB読み取り削減
10. **カスケード削除**: Session削除時に関連Hanchan・PlayerResultも削除
