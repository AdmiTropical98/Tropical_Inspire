; --- ALGARTEMPO Inno Setup Script ---
#define MyAppName "ALGARTEMPO FROTA ENTERPRISE"
#define MyAppExeName "ALGARTEMPO.exe"
#define MyAppPublisher "ALGARTEMPO"
#define MyAppURL "https://algartempo.pt"
#ifndef MyAppVersion
  #define MyAppVersion "1.9.1"
#endif

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={pf}\ALGARTEMPO
DefaultGroupName=ALGARTEMPO
OutputBaseFilename=ALGARTEMPO-Setup-{#MyAppVersion}
WizardImageFile=sidebar.bmp
WizardSmallImageFile=header-small.bmp
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=no
DisableReadyPage=no
DisableFinishedPage=no
DisableStartupPrompt=yes
Uninstallable=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
SetupIconFile=exeicon.ico

[Files]
Source: "..\..\release\win-unpacked\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\ALGARTEMPO FROTA"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar ALGARTEMPO FROTA"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar ALGARTEMPO FROTA"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
