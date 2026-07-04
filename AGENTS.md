# 星卡指挥营 AGENTS

> 儿童英语 + 数学 + 策略卡牌演练 App。目标是让孩子先完成轻量训练，再用学习奖励获得卡牌、组建 12 张小队并打一局单机策略演练。

## 先读文件

- `README.md`：产品定位、运行命令、数据边界。
- `web/words.js`：英语词库和本地音频路径。
- `web/math.js`：数学自适应题目生成器。
- `web/content/cards.js`：96 张原创卡池、6 套默认卡组、3 套 AI 卡组。
- `web/battle.js`：简化卡牌对战引擎、回合逻辑和 AI 行动。
- `web/app.js`：状态管理、路由、学习逻辑、奖励、卡库、战场 UI、本地存档。
- `web/index.html`：基地/训练/卡库/战场/家长页面结构。
- `web/styles.css`：游戏 UI、学习 UI、卡牌、战场和底部导航样式。

## 产品边界

- 用户是低年级孩子：学习题目要短，答错不扣分、不挫败、不自动暴露正确答案。
- 娱乐是学习后的奖励，不接联网、不接充值、不接广告、不接排行榜。
- 卡牌战只参考策略卡牌机制与桌面演练氛围：总部、行动点、支援区、前线区、卡组、单位推进、攻击总部。
- 不复制 KARDS 官方 Logo、卡图、真实卡牌名、完整数据库或 UI 截图；不复制线下照片里的卡名、图案、文案和数据。
- 本地存档 key：`kids-learn-card-camp-state-v1`。

## 常用命令

- H5 预览：进入 `web/` 后执行 `python -m http.server 5178`。
- JS 语法检查：`node --check web/app.js`、`node --check web/battle.js`、`node --check web/content/cards.js`、`node --check web/math.js`、`node --check web/words.js`、`node --check web/sw.js`。
- Android 构建：进入 `android/` 后执行 `.\gradlew.bat assembleDebug`。

## 验收标准

- 基地页像游戏主基地，训练页明亮温和，卡库有补给箱/收藏册/当前卡组三个 Tab。
- 收藏册显示 96 张卡牌的已拥有/未拥有状态，当前卡组保持 12 张。
- 答错不推进、不扣分、不羞辱；答对后增加星星、补给点或卡包进度。
- 补给箱能开包，重复卡转为训练徽章。
- 对战可完成一局：部署、推进、攻击、结束回合、AI 行动、胜负结算。
- Android debug APK 构建成功并能加载本地 `web/index.html`。
