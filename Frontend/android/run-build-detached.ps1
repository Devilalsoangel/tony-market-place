$env:JAVA_HOME='C:\Users\TONI\java\jdk21'
$env:Path='C:\Users\TONI\java\jdk21\bin;' + $env:Path
Set-Location 'C:\Users\TONI\projects\social-commerce\Frontend\android'
.\gradlew.bat assembleDebug --console=plain 2>&1 | Tee-Object -FilePath '.\build.log' -Encoding utf8
