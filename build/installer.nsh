!define FEISHIN_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\5e237764-c1a1-5856-bdf0-e4274e3b5310"

!macro customInit
    ReadRegStr $R0 HKCU "${FEISHIN_UNINSTALL_KEY}" "QuietUninstallString"
    ${If} $R0 == ""
        ReadRegStr $R0 HKLM "${FEISHIN_UNINSTALL_KEY}" "QuietUninstallString"
    ${EndIf}

    ${If} $R0 != ""
        IfSilent uninstall_feishin confirm_uninstall_feishin

        confirm_uninstall_feishin:
        MessageBox MB_ICONQUESTION|MB_YESNO "Feishin is installed. EAJelly must uninstall it before continuing. Continue?" IDYES uninstall_feishin
        Abort

        uninstall_feishin:
        DetailPrint "Uninstalling Feishin..."
        ExecWait $R0 $R1
        ${If} $R1 != 0
            MessageBox MB_ICONSTOP|MB_OK "Feishin could not be uninstalled. EAJelly setup will now close."
            Abort
        ${EndIf}
    ${EndIf}
!macroend
