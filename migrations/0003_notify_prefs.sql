-- 通知設定の個別化（フェーズ3-2）: 通知する警戒レベルのしきい値と通知時刻(JST)。
-- 初期値は現行どおり「注意以上・20時」。
ALTER TABLE users ADD COLUMN notify_min TEXT NOT NULL DEFAULT 'caution';
ALTER TABLE users ADD COLUMN notify_hour INTEGER NOT NULL DEFAULT 20;
