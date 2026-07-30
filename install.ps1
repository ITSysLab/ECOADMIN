$repoUrl = "https://github.com/ITSysLab/ECOADMIN/archive/refs/heads/master.zip"
$destZip = "$env:TEMP\ECOADMIN.zip"
$destFolder = "C:\ECOADMIN-Extension"

Write-Host "Скачивание расширения ECOADMIN из GitHub..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $repoUrl -OutFile $destZip

Write-Host "Распаковка архива..." -ForegroundColor Cyan
if (Test-Path $destFolder) {
    Remove-Item -Recurse -Force $destFolder
}
Expand-Archive -Path $destZip -DestinationPath $env:TEMP -Force

# Архиватор GitHub добавляет "-master" к названию папки
Move-Item -Path "$env:TEMP\ECOADMIN-master" -Destination $destFolder -Force
Remove-Item $destZip -Force

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "Успешно! Файлы расширения скопированы." -ForegroundColor Green
Write-Host "Папка: $destFolder" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Остался последний шаг - подключить его в Chrome:"
Write-Host "1. В браузере Chrome перейдите по адресу: chrome://extensions/"
Write-Host "2. Включите 'Режим разработчика' (справа вверху)"
Write-Host "3. Нажмите 'Загрузить распакованное расширение'"
Write-Host "4. Выберите папку: $destFolder"
Write-Host ""
Write-Host "Открываю страницу расширений Chrome..." -ForegroundColor Cyan

# Пытаемся открыть хром на нужной странице
Start-Process "chrome.exe" "chrome://extensions/"

Write-Host "Готово! Можете закрыть это окно." -ForegroundColor DarkGray
Start-Sleep -Seconds 5
