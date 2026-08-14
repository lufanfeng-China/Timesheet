param(
  [Parameter(Mandatory = $true)]
  [string]$StartDate,

  [Parameter(Mandatory = $true)]
  [string]$EndDate
)

$ErrorActionPreference = "Stop"

$outlook = New-Object -ComObject Outlook.Application
$namespace = $outlook.GetNamespace("MAPI")
$defaultCalendar = $namespace.GetDefaultFolder(9)

$calendarDefinitions = @(
  @{ Member = "Sky"; Folder = $defaultCalendar; FolderName = "Calendar" },
  @{ Member = "Dai"; Folder = $defaultCalendar.Folders.Item("Dai, Qi"); FolderName = "Dai, Qi" },
  @{ Member = "Mia"; Folder = $defaultCalendar.Folders.Item("Geng, Mia"); FolderName = "Geng, Mia" },
  @{ Member = "Sara"; Folder = $defaultCalendar.Folders.Item("Qin, Sara"); FolderName = "Qin, Sara" }
)

$rangeStart = [datetime]::Parse($StartDate)
$rangeEndExclusive = [datetime]::Parse($EndDate).AddDays(1)
$items = New-Object System.Collections.Generic.List[object]

foreach ($calendar in $calendarDefinitions) {
  $folderItems = $calendar.Folder.Items
  $folderItems.IncludeRecurrences = $true
  $folderItems.Sort("[Start]")

  $filter = "[Start] >= '" + $rangeStart.ToString("MM/dd/yyyy hh:mm tt") + "' AND [Start] < '" + $rangeEndExclusive.ToString("MM/dd/yyyy hh:mm tt") + "'"
  $filteredItems = $folderItems.Restrict($filter)

  foreach ($item in $filteredItems) {
    if ($item.Class -ne 26) {
      continue
    }

    $items.Add(
      [pscustomobject]@{
        member = $calendar.Member
        sourceFile = "Outlook / " + $calendar.FolderName
        subject = [string]$item.Subject
        start = ([datetime]$item.Start).ToString("s")
        end = ([datetime]$item.End).ToString("s")
        allDay = [bool]$item.AllDayEvent
        busyStatus = [int]$item.BusyStatus
        organizer = [string]$item.Organizer
        location = [string]$item.Location
      }
    )
  }
}

$items | ConvertTo-Json -Depth 4
