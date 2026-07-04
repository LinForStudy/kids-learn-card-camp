param(
  [string]$ProjectRoot = "C:\06code\vibecoding\kids-star-card-camp"
)
$ErrorActionPreference = "Stop"
$audioDir = Join-Path $ProjectRoot "web\audio"
New-Item -ItemType Directory -Force -Path $audioDir | Out-Null
$words = @(
  @{id='red'; word='red'}, @{id='blue'; word='blue'}, @{id='yellow'; word='yellow'}, @{id='green'; word='green'}, @{id='black'; word='black'}, @{id='white'; word='white'}, @{id='pink'; word='pink'}, @{id='orange-color'; word='orange'},
  @{id='cat'; word='cat'}, @{id='dog'; word='dog'}, @{id='bird'; word='bird'}, @{id='fish'; word='fish'}, @{id='duck'; word='duck'}, @{id='rabbit'; word='rabbit'}, @{id='cow'; word='cow'}, @{id='pig'; word='pig'},
  @{id='apple'; word='apple'}, @{id='banana'; word='banana'}, @{id='pear'; word='pear'}, @{id='orange-fruit'; word='orange'}, @{id='grape'; word='grape'}, @{id='watermelon'; word='watermelon'}, @{id='lemon'; word='lemon'}, @{id='peach'; word='peach'},
  @{id='head'; word='head'}, @{id='eye'; word='eye'}, @{id='ear'; word='ear'}, @{id='nose'; word='nose'}, @{id='mouth'; word='mouth'}, @{id='hand'; word='hand'}, @{id='foot'; word='foot'}, @{id='leg'; word='leg'},
  @{id='book'; word='book'}, @{id='bag'; word='bag'}, @{id='pen'; word='pen'}, @{id='pencil'; word='pencil'}, @{id='ruler'; word='ruler'}, @{id='desk'; word='desk'}, @{id='chair'; word='chair'}, @{id='eraser'; word='eraser'},
  @{id='mom'; word='mom'}, @{id='dad'; word='dad'}, @{id='baby'; word='baby'}, @{id='boy'; word='boy'}, @{id='girl'; word='girl'}, @{id='home'; word='home'}, @{id='bed'; word='bed'}, @{id='cup'; word='cup'}
)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'en-*' } | Select-Object -First 1
if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }
$synth.Rate = -2
foreach ($item in $words) {
  $path = Join-Path $audioDir ($item.id + '.wav')
  if (Test-Path $path) { Remove-Item -LiteralPath $path -Force }
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($item.word)
  $synth.SetOutputToNull()
}
$synth.Dispose()
$files = Get-ChildItem -LiteralPath $audioDir -Filter *.wav
$bad = $files | Where-Object { $_.Length -lt 1000 }
if ($files.Count -ne $words.Count -or $bad.Count -gt 0) {
  throw "Audio generation incomplete. files=$($files.Count), tooSmall=$($bad.Count)"
}
Write-Output "generated $($files.Count) wav files in $audioDir"

