#define MyAppName "ALGARTEMPO FROTA"
#define MyAppExeName "ALGARTEMPO.exe"
#define MyAppPublisher "ALGARTEMPO"
#define MyAppURL "https://algartempo.pt"
#ifndef MyAppVersion
  #define MyAppVersion "1.9.1"
#endif

[Setup]
AppId={{7FD1A4F0-BE3D-45E1-9A24-5439AFD89428}
AppName=ALGARTEMPO FROTA
AppVersion=1.9.1
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\\ALGARTEMPO
DefaultGroupName=ALGARTEMPO
AllowNoIcons=yes
LicenseFile=
InfoAfterFile=
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\\..\\release
OutputBaseFilename=ALGARTEMPO-Setup-{#MyAppVersion}-Inno
SetupIconFile=exeicon.ico
UninstallDisplayIcon={app}\\{#MyAppExeName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern windows11 includetitlebar
WizardStyleFile=Styles\\Luna.vsf
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizardsmall.bmp
DisableWelcomePage=no
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\\..\\release\\win-unpacked\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\\ALGARTEMPO"; Filename: "{app}\\{#MyAppExeName}"
Name: "{autodesktop}\\ALGARTEMPO"; Filename: "{app}\\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\\{#MyAppExeName}"; Description: "Iniciar ALGARTEMPO agora"; Flags: nowait postinstall skipifsilent
