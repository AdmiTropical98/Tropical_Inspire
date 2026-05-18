#define MyAppName "ALGARTEMPO FROTA"
#define MyAppExeName "ALGARTEMPO.exe"
#define MyAppPublisher "ALGARTEMPO"
#define MyAppURL "https://algartempo.pt"
#ifndef MyAppVersion
  #define MyAppVersion "1.9.1"
#endif

#define SkinDll "..\\inno\\isskin\\ISSkin.dll"
#define SkinTheme "..\\inno\\isskin\\Aero.cjstyles"
#define UseSkin FileExists(SkinDll) && FileExists(SkinTheme)

[Setup]
AppId={{7FD1A4F0-BE3D-45E1-9A24-5439AFD89428}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
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
SetupIconFile=..\\exeicon.ico
UninstallDisplayIcon={app}\\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardImageFile=..\\installer\\sidebar.bmp
WizardSmallImageFile=..\\installer\\header-small.bmp
DisableWelcomePage=no
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\\..\\release\\win-unpacked\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
#if UseSkin
Source: "{#SkinDll}"; Flags: dontcopy
Source: "{#SkinTheme}"; Flags: dontcopy
#endif

[Icons]
Name: "{autoprograms}\\ALGARTEMPO"; Filename: "{app}\\{#MyAppExeName}"
Name: "{autodesktop}\\ALGARTEMPO"; Filename: "{app}\\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\\{#MyAppExeName}"; Description: "Iniciar ALGARTEMPO agora"; Flags: nowait postinstall skipifsilent

[Code]
#if UseSkin
function LoadSkin(lpszPath: string; lpszIniFileName: string): Integer;
  external 'LoadSkin@files:ISSkin.dll stdcall delayload';
function UnloadSkin(): Integer;
  external 'UnloadSkin@files:ISSkin.dll stdcall delayload';

function InitializeSetup(): Boolean;
begin
  Result := True;
  try
    ExtractTemporaryFile('ISSkin.dll');
    ExtractTemporaryFile('Aero.cjstyles');
    LoadSkin(ExpandConstant('{tmp}\\Aero.cjstyles'), '');
  except
    Result := True;
  end;
end;

procedure DeinitializeSetup();
begin
  try
    UnloadSkin();
  except
  end;
end;
#endif
