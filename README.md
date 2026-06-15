# 实时比分悬浮窗

一个 Windows 桌面悬浮比分工具，实时读取 Titan007 足球比分数据。

## 功能

- 打开后默认展示正在进行的比赛列表。
- 列表中展示赛事标签、比赛时间、球队和比分。
- 点击某场比赛可进入单场比分面板。
- 支持窗口置顶、自由缩放和半透明显示。

## 开发运行

```powershell
npm install
npm start
```

## 生成 Windows 安装包

```powershell
npm run build:win
```

安装包输出位置：

```text
release/实时比分悬浮窗 Setup 1.0.0.exe
```

`release/` 和 `node_modules/` 不提交到 Git，需要时本地重新安装依赖并打包。

## 私下分发说明

- 当前安装包未购买商业代码签名证书。
- Windows 可能显示 SmartScreen 的“未知发布者”提示。
- 用户通常可以点击“更多信息”后选择“仍要运行”继续安装。
- macOS Apple Silicon 版本暂未交付；不走 App Store 时建议使用 Apple Developer ID 签名和公证。
