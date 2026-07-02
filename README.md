# Timesheet Dashboard

团队日历工时报表。数据范围由导入的 Outlook 日历文件日期自动判断，支持全部数据、单个月、多个月和特定时间区间。

默认本地数据目录：
`C:\Users\Sky.Lu\Thermo Fisher Scientific\IT BA Team - Timesheet`

SharePoint 源文件夹：
`https://thermofisher.sharepoint.com/:f:/r/sites/ITBATeam/Shared%20Documents/General/Timesheet?csf=1&web=1&e=pvWM7c`

## 打开报表

直接打开 `index.html` 即可查看仪表盘。

## 重新生成数据

源文件更新后，在本目录运行：

```powershell
& 'C:\Users\Sky.Lu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'scripts\build_data.py'
```

如需临时指定源目录：

```powershell
$env:TIMESHEET_SOURCE_DIR='C:\path\to\Timesheet'
& 'C:\Users\Sky.Lu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'scripts\build_data.py'
```

脚本会重新生成 `data\timesheet-data.js`。

## 报表口径

- 日期范围：按 Outlook 导出文件中的 `Start Date` 判断，并输出可选择的月份清单。
- 标准工时：当前选择范围内的配置工作日 × 8 小时。
- 日历配置：可手动设置节假日，也可以把双休日设置成补班工作日；配置保存在浏览器本地。
- 默认隐藏：取消会议、全天事件、提醒类事件。
- 命名分类：`PROJ/Project`、`CR`、`MGMT`、`SUP`。
- `Proj-[...]` 会把 `[]` 中的内容作为项目名称。
- `CR` 会优先提取主题中的 `TFSXXX`；如果 APP 对照表中存在该 code，报表会显示 `App Name` 替代 TFS code。
- APP 对照表来自源目录中的 `App List*.xlsx`，使用 `App Code` 和 `App Name` 两列。
- PTO 作为个人休假 credit；配置节假日会从标准工时中扣除。
- 未匹配四类前缀的工作事件进入 `Other`，用于复核命名规范。
