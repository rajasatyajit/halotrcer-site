<#
.SYNOPSIS
Install sievant on Windows (https://github.com/rajasatyajit/sievant).

.DESCRIPTION
What it does, in order (every step is commented below):
  1. detects the CPU (an x64 PowerShell on Windows on Arm still gets the
     native arm64 build: the OS architecture decides, not the process);
  2. resolves the version (the latest published release unless -Version);
  3. stops if that version is already installed (safe to run again);
  4. downloads the release zip and checksums.txt from GitHub;
  5. verifies checksums.txt's cosign signature when cosign is installed
     (required with -RequireCosign), then the zip's SHA-256;
  6. installs sievant.exe atomically, then prints a PATH hint if needed and
     the next steps (sievant scan, then sievant wrap --all).

It contacts only GitHub (api.github.com to resolve "latest", github.com for the
release files), never asks for credentials, and with -DryRun contacts nothing.
It never edits PATH itself; it prints the command. Runs on Windows PowerShell
5.1 and PowerShell 7.

Exit codes (when run as a file): 0 installed, already installed or dry run;
1 failure; 2 usage error.

.EXAMPLE
irm https://sievant.halotrcer.com/install.ps1 | iex

.EXAMPLE
& ([scriptblock]::Create((irm https://sievant.halotrcer.com/install.ps1))) -Version v0.2.0 -Dir C:\tools\sievant

.EXAMPLE
powershell -ExecutionPolicy Bypass -File install.ps1 -DryRun
#>
[CmdletBinding()]
param(
	# Install this release (e.g. v0.2.0); default: the latest published release.
	[string]$Version = "",
	# Install into this directory (default: $env:LOCALAPPDATA\Programs\sievant).
	[string]$Dir = "",
	# Install into $env:ProgramFiles\sievant (needs an elevated PowerShell).
	[switch]$Global,
	# Print what would happen; download and change nothing.
	[switch]$DryRun,
	# Skip the SHA-256 and signature checks (not recommended).
	[switch]$NoVerify,
	# Fail unless cosign is installed and the signature verifies.
	[switch]$RequireCosign
)

# --- Constants -----------------------------------------------------------------

# Script-scope names all start with Sievant: smoke.ps1 dot-sources this file
# for Invoke-SievantNative, and PowerShell variable names are case-insensitive,
# so a plain $script:Repo once overwrote the caller's $repo
# (TestPS1DotSourcingKeepsTheCallersVariables).

$script:SievantRepo = 'rajasatyajit/sievant'
# The identity cosign must see on the checksum file's signature: the release
# workflow of this repository, running on a version tag.
$script:SievantCosignIdentityRegexp = '^https://github\.com/rajasatyajit/sievant/\.github/workflows/release\.yml@refs/tags/v'
$script:SievantCosignOidcIssuer = 'https://token.actions.githubusercontent.com'
$script:SievantVersionPattern = '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'

# A usage error (exit 2), as distinct from a failure (exit 1).
class SievantUsageError : System.Exception {
	SievantUsageError([string]$message) : base($message) {}
}

function Write-Step([string]$Message) {
	# Progress goes to the host, never the output stream.
	Write-Host "sievant-install: $Message"
}

# --- Seams (small functions so the steps can be tested off Windows) ---------------

function Test-SievantWindows {
	return [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
}

# The OS architecture, not the process's: an x64 PowerShell emulated on Windows
# on Arm reports AMD64 in PROCESSOR_ARCHITECTURE but Arm64 here.
function Get-SievantArch {
	$name = $null
	try {
		$name = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
	} catch {
		# Older .NET without RuntimeInformation: a 32-bit process on 64-bit
		# Windows sees the real CPU in PROCESSOR_ARCHITEW6432.
		$name = $env:PROCESSOR_ARCHITEW6432
		if (-not $name) { $name = $env:PROCESSOR_ARCHITECTURE }
	}
	switch ($name) {
		'X64' { return 'amd64' }
		'AMD64' { return 'amd64' }
		'Arm64' { return 'arm64' }
		default { throw "unsupported CPU: $name (release builds exist for amd64 and arm64)" }
	}
}

# ConvertTo-SievantArgument quotes one argument for a Windows command line
# (the rules CommandLineToArgvW and the .NET runtime parse back): needed
# because Windows PowerShell 5.1 runs on .NET Framework, whose ProcessStartInfo
# has no ArgumentList, only one Arguments string.
function ConvertTo-SievantArgument([string]$Value) {
	if ($Value -ne '' -and $Value -notmatch '[\s"]') { return $Value }
	$sb = New-Object System.Text.StringBuilder
	[void]$sb.Append('"')
	$backslashes = 0
	foreach ($ch in $Value.ToCharArray()) {
		if ($ch -eq [char]'\') {
			$backslashes++
		} elseif ($ch -eq '"') {
			[void]$sb.Append([char]'\', 2 * $backslashes + 1).Append('"')
			$backslashes = 0
		} else {
			if ($backslashes -gt 0) { [void]$sb.Append([char]'\', $backslashes) }
			[void]$sb.Append($ch)
			$backslashes = 0
		}
	}
	if ($backslashes -gt 0) { [void]$sb.Append([char]'\', 2 * $backslashes) }
	[void]$sb.Append('"')
	return $sb.ToString()
}

# Invoke-SievantNative runs a native program and returns its exit code, stdout
# and stderr, captured separately. Success is the exit code alone. Windows
# PowerShell 5.1 turns every line a native program writes to stderr into an
# error record, and under $ErrorActionPreference = 'Stop' the first one aborts
# the script - even with 2>$null, even when the program succeeded (cosign
# prints "Verified OK" to stderr). Running the program through
# System.Diagnostics.Process keeps its stderr away from PowerShell's error
# stream on 5.1 and 7 alike. Every native call in this script goes through
# here (a test enforces it).
function Invoke-SievantNative([string]$FilePath, [string[]]$Arguments = @()) {
	$psi = New-Object System.Diagnostics.ProcessStartInfo
	$psi.FileName = $FilePath
	$psi.Arguments = (@($Arguments | ForEach-Object { ConvertTo-SievantArgument $_ }) -join ' ')
	$psi.UseShellExecute = $false
	$psi.RedirectStandardOutput = $true
	$psi.RedirectStandardError = $true
	$psi.CreateNoWindow = $true
	$p = New-Object System.Diagnostics.Process
	$p.StartInfo = $psi
	[void]$p.Start()
	# Both pipes are drained concurrently, so neither can fill and stall the
	# child.
	$stderrTask = $p.StandardError.ReadToEndAsync()
	$stdout = $p.StandardOutput.ReadToEnd()
	$p.WaitForExit()
	return [pscustomobject]@{ ExitCode = $p.ExitCode; StdOut = $stdout; StdErr = $stderrTask.Result }
}

# The first line `sievant version` prints: "sievant vX.Y.Z", on stderr (its
# v0.1.0 format; stdout is read too, in case a later version moves it).
function Get-SievantVersionLine([string]$Exe) {
	try {
		$r = Invoke-SievantNative $Exe @('version')
	} catch {
		return ''
	}
	$text = $r.StdErr
	if ($r.StdOut) { $text = $r.StdOut }
	if ($r.ExitCode -ne 0 -or -not $text) { return '' }
	return ($text -split "`r?`n")[0]
}

function Test-SievantElevated {
	$id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
	return (New-Object System.Security.Principal.WindowsPrincipal($id)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

# An overridden endpoint (a mirror or a test server) must be https, or plain
# http to this machine only.
function Assert-SievantEndpoint([string]$Url, [string]$Name) {
	$uri = $null
	if (-not [System.Uri]::TryCreate($Url, [System.UriKind]::Absolute, [ref]$uri)) {
		throw [SievantUsageError]::new("$Name must be an https URL (or http to a loopback host), got: $Url")
	}
	$loopback = @('127.0.0.1', 'localhost', '[::1]', '::1') -contains $uri.Host
	if (-not ($uri.Scheme -eq 'https' -or ($uri.Scheme -eq 'http' -and $loopback))) {
		throw [SievantUsageError]::new("$Name must be an https URL (or http to a loopback host), got: $Url")
	}
}

function Get-SievantFile([string]$Url, [string]$OutFile) {
	Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

# --- The installer ---------------------------------------------------------------

function Install-Sievant {
	param(
		[string]$Version = "",
		[string]$Dir = "",
		[switch]$Global,
		[switch]$DryRun,
		[switch]$NoVerify,
		[switch]$RequireCosign
	)

	# Set inside the function so `irm | iex`, which runs in the caller's scope,
	# leaves the user's session preferences alone. PowerShell scopes are
	# dynamic, so the helpers called from here inherit them.
	Set-StrictMode -Version 2.0
	$ErrorActionPreference = 'Stop'
	# Invoke-WebRequest is many times slower with its progress bar on 5.1.
	$ProgressPreference = 'SilentlyContinue'
	# Windows PowerShell 5.1 on older .NET may not offer TLS 1.2 by default;
	# GitHub requires it. This adds TLS 1.2 to what is allowed, removing nothing.
	try {
		[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12
	} catch {
		Write-Verbose 'could not adjust SecurityProtocol; continuing with the defaults'
	}

	# Step 0: refuse contradictory or malformed options before anything runs.
	if ($Global -and $Dir) { throw [SievantUsageError]::new('-Dir and -Global are mutually exclusive') }
	if ($NoVerify -and $RequireCosign) { throw [SievantUsageError]::new('-NoVerify and -RequireCosign are mutually exclusive') }
	if ($Version) {
		# Accept "0.2.0" as well as "v0.2.0"; the release tags carry the v.
		if (-not $Version.StartsWith('v')) { $Version = "v$Version" }
		if ($Version -notmatch $script:SievantVersionPattern) {
			throw [SievantUsageError]::new("-Version must look like v1.2.3 or v1.2.3-rc.1, got: $Version")
		}
	}
	$downloadBase = $env:SIEVANT_INSTALL_DOWNLOAD_BASE
	if (-not $downloadBase) { $downloadBase = "https://github.com/$script:SievantRepo/releases/download" }
	$apiBase = $env:SIEVANT_INSTALL_API_BASE
	if (-not $apiBase) { $apiBase = "https://api.github.com/repos/$script:SievantRepo" }
	Assert-SievantEndpoint $downloadBase 'SIEVANT_INSTALL_DOWNLOAD_BASE'
	Assert-SievantEndpoint $apiBase 'SIEVANT_INSTALL_API_BASE'

	# Step 1: the platform. This is the Windows installer; install.sh covers
	# Linux and macOS.
	if (-not (Test-SievantWindows)) {
		throw 'this is the Windows installer; on Linux and macOS use install.sh (see docs/install.md)'
	}
	$arch = Get-SievantArch

	# Step 2: the destination. -Global writes under Program Files, which needs
	# an elevated PowerShell; there is no silent elevation.
	if ($Global) {
		$Dir = Join-Path $env:ProgramFiles 'sievant'
	} elseif (-not $Dir) {
		if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set; pass -Dir' }
		$Dir = Join-Path $env:LOCALAPPDATA 'Programs\sievant'
	}
	$target = Join-Path $Dir 'sievant.exe'

	# Dry run: print the plan, contact nothing.
	if ($DryRun) {
		if ($Version) {
			$shown = $Version
			$zip = "sievant_$($Version.Substring(1))_windows_$arch.zip"
		} else {
			$shown = "latest (resolved from $apiBase/releases/latest at install time)"
			$zip = "sievant_<version>_windows_$arch.zip"
		}
		Write-Step 'dry run: nothing will be downloaded or changed'
		Write-Step "platform:     windows/$arch"
		Write-Step "version:      $shown"
		Write-Step "archive:      $downloadBase/<tag>/$zip"
		if ($NoVerify) {
			Write-Step 'verify:       SKIPPED (-NoVerify)'
		} else {
			$req = ''
			if ($RequireCosign) { $req = ' (required)' }
			Write-Step "verify:       SHA-256 against checksums.txt; cosign signature of checksums.txt if cosign is installed$req"
		}
		Write-Step "install to:   $target"
		return
	}

	if ($Global -and -not (Test-SievantElevated)) {
		throw "-Global installs into $Dir, which needs an elevated PowerShell (Run as administrator), or pass -Dir"
	}

	# Step 3: cosign is optional unless -RequireCosign; checked before downloading.
	$cosign = $null
	if (-not $NoVerify) {
		$cosign = Get-Command cosign -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
		if (-not $cosign -and $RequireCosign) {
			throw '-RequireCosign: cosign is not installed (https://docs.sigstore.dev/cosign/system_config/installation/)'
		}
	}

	# A scratch directory for everything downloaded; removed on every exit path.
	$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("sievant-install-" + [System.Guid]::NewGuid().ToString('N'))
	New-Item -ItemType Directory -Path $tmp | Out-Null
	try {
		# Step 4: resolve the version: the latest PUBLISHED release (drafts are
		# not visible here).
		if (-not $Version) {
			try {
				$latest = Invoke-RestMethod -Uri "$apiBase/releases/latest" -UseBasicParsing
			} catch {
				throw "could not find the latest release at $apiBase/releases/latest; pass -Version"
			}
			$Version = [string]$latest.tag_name
			if ($Version -notmatch $script:SievantVersionPattern) {
				throw "the latest release has an unexpected tag ($Version); pass -Version"
			}
		}
		Write-Step "installing sievant $Version for windows/$arch into $Dir"

		# Step 5: stop if this version is already installed (idempotent).
		if (Test-Path -LiteralPath $target -PathType Leaf) {
			$line = Get-SievantVersionLine $target
			if ($line -eq "sievant $Version" -or $line.StartsWith("sievant $Version ")) {
				Write-Step "sievant $Version is already installed at $target; nothing to do"
				return
			}
		}

		# Step 6: download the zip and the checksum file.
		$zip = "sievant_$($Version.Substring(1))_windows_$arch.zip"
		$base = "$downloadBase/$Version"
		Write-Step "downloading $base/$zip"
		try { Get-SievantFile "$base/$zip" (Join-Path $tmp $zip) } catch { throw "download failed: $base/$zip" }

		# Step 7: verify the signature, then the checksum.
		if (-not $NoVerify) {
			$sums = Join-Path $tmp 'checksums.txt'
			try { Get-SievantFile "$base/checksums.txt" $sums } catch { throw "download failed: $base/checksums.txt" }

			# The signature first: it is what makes the checksum file trustworthy.
			if ($cosign) {
				$bundle = Join-Path $tmp 'checksums.txt.sigstore.json'
				try { Get-SievantFile "$base/checksums.txt.sigstore.json" $bundle } catch { throw "download failed: $base/checksums.txt.sigstore.json" }
				# cosign reports success on stderr; the exit code decides.
				$v = Invoke-SievantNative $cosign.Source @('verify-blob', '--bundle', $bundle,
					'--certificate-identity-regexp', $script:SievantCosignIdentityRegexp,
					'--certificate-oidc-issuer', $script:SievantCosignOidcIssuer, $sums)
				if ($v.ExitCode -ne 0) {
					throw "cosign could not verify checksums.txt as signed by $script:SievantRepo's release workflow; nothing was installed"
				}
				Write-Step "cosign: checksums.txt is signed by $script:SievantRepo's release workflow"
			} else {
				Write-Step 'cosign not found: the signature was not checked (SHA-256 only; install cosign or pass -RequireCosign)'
			}

			# Then the zip's SHA-256 against its exact line in checksums.txt.
			$want = $null
			foreach ($l in Get-Content -LiteralPath $sums) {
				$parts = $l -split '\s+', 2
				if ($parts.Count -eq 2 -and $parts[1] -eq $zip) { $want = $parts[0].ToLowerInvariant() }
			}
			if (-not $want) { throw "$zip is not listed in checksums.txt; nothing was installed" }
			$got = (Get-FileHash -LiteralPath (Join-Path $tmp $zip) -Algorithm SHA256).Hash.ToLowerInvariant()
			if ($got -ne $want) { throw "SHA-256 mismatch for $zip (expected $want, got $got); nothing was installed" }
			Write-Step 'SHA-256 verified'
		} else {
			Write-Warning 'sievant-install: -NoVerify: the download''s SHA-256 and signature were NOT checked'
		}

		# Step 8: unpack and check the binary runs.
		$unpacked = Join-Path $tmp 'unpacked'
		Expand-Archive -LiteralPath (Join-Path $tmp $zip) -DestinationPath $unpacked
		$exe = Join-Path $unpacked 'sievant.exe'
		if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw "sievant.exe is not in $zip" }
		if (-not (Get-SievantVersionLine $exe)) { throw 'the downloaded binary does not run on this machine' }

		# Step 9: install atomically. Copy next to the destination, then rename
		# over it, so an interrupted install never leaves half a sievant.exe.
		New-Item -ItemType Directory -Path $Dir -Force | Out-Null
		$staged = Join-Path $Dir '.sievant.new.exe'
		Copy-Item -LiteralPath $exe -Destination $staged -Force
		try {
			Move-Item -LiteralPath $staged -Destination $target -Force
		} catch {
			Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
			throw "could not replace $target (is sievant running?): $($_.Exception.Message)"
		}
		Write-Step "installed: $(Get-SievantVersionLine $target)"

		# Step 10: PATH hint; PATH itself is never edited here.
		$onPath = @($env:Path -split ';' | Where-Object { $_.TrimEnd('\') -ieq $Dir.TrimEnd('\') }).Count -gt 0
		if (-not $onPath) {
			Write-Step "$Dir is not on your PATH; to add it for your user, run:"
			Write-Step "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';$Dir', 'User')"
		}

		# Step 11: next steps.
		Write-Step 'next: sievant scan        (read-only audit of the MCP client configurations on this machine)'
		Write-Step 'then: sievant wrap --all  (route those MCP servers through Sievant; sievant unwrap restores them)'
	} finally {
		Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
	}
}

# --- Entry point ----------------------------------------------------------------------

# Maps the outcome to an exit code: 0 done, 1 failure, 2 usage error.
function Invoke-SievantInstallMain([hashtable]$Options) {
	try {
		Install-Sievant @Options
		return 0
	} catch [SievantUsageError] {
		Write-Host "sievant-install: error: $($_.Exception.Message)"
		Write-Host 'sievant-install: run Get-Help .\install.ps1 for usage'
		return 2
	} catch {
		Write-Host "sievant-install: error: $($_.Exception.Message)"
		return 1
	}
}

# Dot-sourcing (". .\install.ps1") only defines the functions above; the tests
# use that. Run as a file, the script exits with the code; run through iex or a
# scriptblock it must not call exit, which would close the user's shell, so it
# sets $LASTEXITCODE instead.
if ($MyInvocation.InvocationName -ne '.') {
	$code = Invoke-SievantInstallMain @{
		Version = $Version; Dir = $Dir; Global = $Global; DryRun = $DryRun
		NoVerify = $NoVerify; RequireCosign = $RequireCosign
	}
	if ($PSCommandPath) {
		exit $code
	}
	$global:LASTEXITCODE = $code
}
