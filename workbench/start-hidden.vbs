Option Explicit
Dim fso, sh, root, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
cmd = "pythonw.exe " & Chr(34) & root & "\workbench\server.py" & Chr(34) & " --no-open"
sh.Run cmd, 0, False
