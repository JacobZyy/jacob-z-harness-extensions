---
name: demand-skill
description: 用于分析 TAPD 需求链接或 TAPD 需求 ID，提取前端需求，并生成标准化的前端需求 Markdown 文档。当用户提供 TAPD 链接（域名包含 tapd.cn）或 TAPD 需求 ID 并要求进行需求分析或生成前端需求文档时使用。
---

# TAPD 前端需求 Skill

## 目标

读取 TAPD 需求，提取前端需求，生成标准的**前端需求文档**。

## 触发条件

满足任一即启用：
- 用户输入包含 `tapd.cn` URL
- 用户直接提供 TAPD workspaceId 或 storyId

### TAPD 链接解析

- story_id 格式：`11` + `workspace_id(8位)` + `序号`
- workspace_id = story_id[2:10]
- 支持格式：
  1. `?dialog_preview_id=story_XXXX`
  2. `/{workspace_id}/prong/stories/view/{story_id}`
  3. `/tapd_fe/{workspace_id}/story/detail/{story_id}`

## 步骤一：获取需求内容

```bash
bun run packages/marketplace-share/src/demand-skill/cli.ts "<TAPD_URL>" --format text
bun run packages/marketplace-share/src/demand-skill/cli.ts <workspace_id> --story-id <story_id> --format json
```

参数：`--story-id/-s`、`--page/-p`（默认1）、`--page-size/-n`（默认10）、`--format/-f`（json/text）

## 步骤二：转为标准化 JSON

根据 TAPD 数据，由模型直接生成标准 JSON。

**JSON 结构示例：**

```json
{
  "需求背景": [
    { "需求来源": "" },
    { "解决什么问题": "" },
    { "主要功能点": "" }
  ],
  "产品方案": [
    { "text": "", "images": [] }
  ]
}
```

## 步骤三：生成前端需求文档

使用规范化数据，按以下模板生成 Markdown 文档：

```markdown
# [项目名称] 前端需求文档

## 一、背景与目标
- 背景：
- 业务目标：

## 二、整体说明
- 适用平台：
- 主要用户角色：
- 业务流程简述：

## 三、页面与模块拆分

### 3.x [页面/模块名称]
- 功能概述：
- 入口路径：
- 关联接口：

#### 3.x.1 页面结构
- 布局说明：
- 主要区域/组件：

#### 3.x.2 交互与状态
- 交互流程：
- 空状态/加载/异常状态：

#### 3.x.3 视觉与图片资源
- TAPD 图片：保留原始 URL，标注"需登录 TAPD 查看"

## 四、非功能需求
- 性能要求：
- 兼容性要求：

## 五、技术方案格式规范说明

### 代码片段引用规则
- 表格内引用：`<a href="#代码片段N">代码片段N</a>`
- 标题：`<h3 id="代码片段N">代码片段N</h3>`
- 编号从1开始，按出现顺序递增

### 修改点格式
- 格式：`改动点N：描述`、`新增点N：描述`、`删除点N：描述`
- 编号从1开始连续递增
```

### 文档生成要求

1. 严格基于源文档内容，不凭空臆造
2. 只包含前端需求
3. 结构分为改动点、新增点、删除点
4. 保留前端界面图片与文本的对应关系
5. 最终直接输出 md 文档，命名以 `日期_需求名称.md` 保存到 `./docs/zagent/`
