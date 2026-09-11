$env:JAVA_HOME='C:\Users\TONI\java\jdk-21.0.12+8'
$env:Path='C:\Users\TONI\java\jdk-21.0.12+8\bin;' + $env:Path
Set-Location 'C:\Users\TONI\projects\social-commerce\Frontend\android'
.\gradlew.bat assembleDebug --stacktrace 2>&1 | Tee-Object -FilePath '.\build.log' -Encoding utf8
