# Timesheet Dashboard

团队日历工时报表。

当前版本的数据源已经切换为本机 Outlook 日历，直接读取以下 4 个日历并生成前端展示数据：

- `Sky`
- `Dai, Qi`
- `Geng, Mia`
- `Qin, Sara`

当前默认刷新范围：

- `2026-06-01` 到 `2026-07-31`

外部文件仍保留以下用途：

- `App List*.xlsx`：TFS code -> APP name 映射
- `CR Report*.xlsx`：CR 提交 / 上线趋势

默认外部文件目录：

- `C:\Users\Sky.Lu\Thermo Fisher Scientific\IT BA Team - Timesheet`

## 打开报表

直接打开 `index.html` 即可。

## 重新生成数据

在项目目录运行：

```powershell
python scripts\build_data.py
```

如果要临时修改外部映射文件目录：

```powershell
$env:TIMESHEET_SOURCE_DIR='C:\path\to\Timesheet'
python scripts\build_data.py
```

如果要调整 Outlook 刷新时间范围：

```powershell
$env:TIMESHEET_RANGE_START='2026-06-01'
$env:TIMESHEET_RANGE_END='2026-07-31'
python scripts\build_data.py
```

脚本会重新生成：

- `data\timesheet-data.js`

## 口径说明

- 标准工时 = 选定范围内配置工作日 × 8 小时
- Holiday 从标准工时中扣除
- PTO 计入工作负荷，不计入工作时间
- 工作负荷 = `(工作时间 + PTO) / 标准工时`
- Project 从 `Proj-[项目名]` 提取项目名
- CR 从标题中的 `TFSXXX` 提取系统，并优先替换为 APP name
- Sup / Mgmt 取空格前的标准前缀，如 `SUP-OPS`、`MGMT-TEAM`
- 取消会议、全天事件、提醒事件默认不计入工时
