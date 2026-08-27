---
name: 盘前电讯
description: 美股夜盘数据与AI研判的A股开盘决策电讯单
colors:
  paper: "#FBF9F4"
  paper-deep: "#F3EFE6"
  ink: "#1C1915"
  ink-70: "rgba(28,25,21,.72)"
  ink-45: "rgba(28,25,21,.46)"
  ink-15: "rgba(28,25,21,.14)"
  seal-red: "#BF3126"
  seal-red-dim: "rgba(191,49,38,.08)"
  down-green: "#256B47"
typography:
  display:
    fontFamily: "'Noto Serif SC','SimSun','Songti SC',serif"
    fontSize: "1.75rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: ".14em"
  headline:
    fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif"
    fontSize: "2.6rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-.01em"
  data:
    fontFamily: "'Consolas','SF Mono','Menlo','Roboto Mono',monospace"
    fontFeature: "tnum"
  body:
    fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif"
    fontSize: ".9375rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "'PingFang SC','Microsoft YaHei','Segoe UI',sans-serif"
    fontSize: ".8125rem"
    fontWeight: 700
    letterSpacing: ".18em"
rounded:
  none: "0"
  seal: "2px"
spacing:
  xs: "7px"
  sm: "11px"
  md: "14px"
  lg: "26px"
  xl: "40px"
components:
  verdict-seal:
    backgroundColor: "transparent"
    textColor: "{colors.seal-red}"
    rounded: "{rounded.seal}"
    size: "76px"
  wire-row-up:
    textColor: "{colors.seal-red}"
  wire-row-down:
    textColor: "{colors.down-green}"
---

# Design System: 盘前电讯

## Overview

**Creative North Star: "行情电讯纸带"**

整个系统是一份清晨从行情电讯机里打出来的记录单：暖白纸面、油墨黑文字、一枚红色判定章。它拒绝通用后台仪表盘的两个默认——暗色卡片脸与进度条仪表；深度靠平面色带与规线表达，概率用对偶大数字表达。文本域保持无彩，颜色只出现在数据语义处。

**Key Characteristics:**
- 纸面平面世界：无阴影、无圆角卡片、无渐变装饰
- 等宽数据行是主角，中文正文退居辅助层级
- 单一红章作为唯一权威动作元素
- 宋体只出现在报头与印章字，是刊物的声音而非装饰衬线

## Colors

纸白底上的油墨黑，一个红。红是涨、是章、是异动标记；绿只说跌。

### Primary
- **印泥红** (#BF3126): 涨跌语义中的"涨"、判定印章、异动斜纹、焦点环。全页唯一强调色。
- **印泥红·淡** (rgba(191,49,38,.08)): 文本选区底色。

### Secondary
- **跌绿** (#256B47): 仅用于下跌数值与"低开"概率数字。不参与任何装饰。

### Neutral
- **纸面** (#FBF9F4): 页面底色。
- **纸面·深** (#F3EFE6): 板块色带的隔行底色，制造平面分区。
- **油墨** (#1C1915): 正文与标题文字、报头双规线。
- **油墨·70/45/15**: 次级文字 / 辅助说明与题头 / 点线分隔。全部由同一油墨色加透明度派生，禁止引入冷灰。

### Named Rules
**The Ink-Only Text Rule.** 颜色只允许出现在数据语义处（涨跌值、印章、异动标记）；一切说明性文字保持油墨色阶，永不染色。
**The Red-is-Up Rule.** 红涨绿跌是A股语义，顺序不可倒置；绿永远不承担"强调"职能。

## Typography

**Display Font:** Noto Serif SC / SimSun（报头、印章字专用）
**Body Font:** PingFang SC / Microsoft YaHei
**Label/Mono Font:** Consolas / SF Mono（一切数字）

**Character:** 宋体报头给刊物定调，正文黑体保持工具的中性，数字一律等宽制表对齐——纸带感由数字的整齐排列产生，而非字体模仿。

### Hierarchy
- **Display** (900, 1.75rem, ls .14em): 刊名「盘前电讯」专用。
- **Headline** (800, 2.6rem): AI研判方向词，首屏唯一大字。
- **Data-Large** (mono 700, 2.1rem): 高开/低开概率对偶数字。
- **Body** (400, .9375rem, lh 1.65): 导语与说明，量宽 ≤52ch。
- **Label** (700, .8125rem, ls .18em): 分组题头（夜盘核心等）。
- **Data** (mono, .875-.9375rem, tnum): 全部行情数值。

### Named Rules
**The Tabular Truth Rule.** 一切数字进等宽栈并开 tnum；对齐即可信。

## Layout

单栏纸面容器 max-width 1120px，内边距 40px/32px。首屏为 11:9 双栏（左AI电头、右夜盘核心），中缝 1px 规线；760px 以下折叠为单列。分区节奏：区块上下 26px，行内 7px 垂直呼吸；题头上方留白大于下方。板块区用整行平面色带（隔行 #F3EFE6）替代卡片网格。

## Elevation & Depth

无阴影。深度由三层表达：纸面色差（#FBF9F4 / #F3EFE6）、规线（3px double 报头线、1px 实线、点线）、以及墨色浓淡（ink 100%/72%/46%）。印章的倾斜 (-4°) 是页面唯一的"物理层"，属于语义动作而非装饰。

## Shapes

全直角（radius 0）。唯一例外：印章 2px，为避免印刷切边感。边框语言：双规线（报头）、实细线（分区）、点线（行间）。斜纹（repeating-linear-gradient 45°）仅用于异动标记这一种语义。

## Components

### 判定印章 (verdict-seal)
- **Shape:** 76px 方形，2px 圆角，2.5px 红描边，整体 -4° 旋转
- **Content:** 宋体判定词（偏强/中性/偏弱）+ 小字置信度
- **Motion:** 入场一次 thump（scale 1.28→1，cubic-bezier(.16,1,.3,1)，220ms）；prefers-reduced-motion 下静止
- **Rule:** 每页仅一枚；它是AI结论的权威落款，不做任何其他用途

### 纸带行 (wire-row)
- **Shape:** 三列网格（名称/数值/含义），点线下划分隔
- **Color:** 名称油墨、数值按涨跌语义着色、说明 ink-45
- **States:** 数据缺失显示"暂无"（ink-45），不空位

### 板块色带 (band)
- **Shape:** 整行平面带，左 8.5em 栏名 + 右侧 ticker 流式排布
- **Background:** 隔行 #F3EFE6，行间 1px 实线
- **Rule:** 不设圆角、不加边框盒，禁卡片化

### 异动标记 (anomaly)
- **Style:** 14px 斜纹小块（红 45°），title 注明"波幅≥3%"
- **Rule:** 仅当 |涨跌幅|≥3% 出现；图例必须在区块题头注明

## Do's and Don'ts

### Do:
- **Do** 保持色彩只在数据语义处；新增元素先问"这是数据还是说明"。
- **Do** 新增行/区块复用 wire-row / band 结构与既有间距节奏（26/14/11/7px）。
- **Do** 每个新指标附一行传导含义（wr-note），维持可追溯性。

### Don't:
- **Don't** 引入阴影、圆角卡片、渐变或进度条仪表——它们属于被拒绝的旧世界。
- **Don't** 用 emoji 或 unicode 字符充当图标；趋势方向用内联 SVG 三角。
- **Don't** 让绿色出现在跌值以外的地方，或红色出现在涨/章/异动以外的地方。
- **Don't** 在正文中使用 em-dash（—）。
