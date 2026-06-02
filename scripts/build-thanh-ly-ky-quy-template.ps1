$ErrorActionPreference = 'Stop'

$rootDir = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$sourcePath = Join-Path $rootDir 'public\VP - Biên bản thanh lý hợp đồng đặt cọc lái xe.doc'
$outputPath = Join-Path $rootDir 'public\thanh_ly_ky_quy_lai_xe_template.docx'

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Không tìm thấy file mẫu gốc: $sourcePath"
}

function Replace-WordText {
  param(
    [Parameter(Mandatory = $true)] $Document,
    [Parameter(Mandatory = $true)] [string] $FindText,
    [Parameter(Mandatory = $true)] [string] $ReplaceText
  )

  $range = $Document.Content
  $find = $range.Find
  $find.ClearFormatting() | Out-Null
  $find.Replacement.ClearFormatting() | Out-Null
  $find.Text = $FindText
  $find.Replacement.Text = $ReplaceText
  $find.Forward = $true
  $find.Wrap = 1
  $find.Format = $false
  $find.MatchCase = $false
  $find.MatchWholeWord = $false
  $find.MatchWildcards = $false
  $find.MatchSoundsLike = $false
  $find.MatchAllWordForms = $false

  $replaceAll = 2
  [void]$find.Execute(
    [ref]$FindText,
    [ref]$false,
    [ref]$false,
    [ref]$false,
    [ref]$false,
    [ref]$false,
    [ref]$true,
    [ref]1,
    [ref]$false,
    [ref]$ReplaceText,
    [ref]$replaceAll
  )
}

$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $sourceObject = [object][string]$sourcePath
  $confirmObject = [object]$false
  $readOnlyObject = [object]$true
  $document = $word.Documents.Open([ref]$sourceObject, [ref]$confirmObject, [ref]$readOnlyObject)

  $outputObject = [object][string]$outputPath
  $formatObject = [object]16
  $document.SaveAs2([ref]$outputObject, [ref]$formatObject)

  Replace-WordText $document 'CÔNG TY CPVT HOÀNG MINH DŨNG – CHI NHÁNH VĨNH PHÚC' '{ten_don_vi_upper}'
  Replace-WordText $document 'CÔNG TY CPVT HOÀNG MINH DŨNG - CHI NHÁNH VĨNH PHÚC' '{ten_don_vi_upper}'
  Replace-WordText $document 'CÔNG TY CPVT HOÀNG MINH DŨNG' '{ten_don_vi_upper}'
  Replace-WordText $document 'CHI NHÁNH VĨNH PHÚC' ' '
  Replace-WordText $document '001200000000/2026/BBTL' '{so_bien_ban}'
  Replace-WordText $document 'ngày 16 tháng 04 năm 2026' 'ngày {ngay_lap} tháng {thang_lap} năm {nam_lap}'
  Replace-WordText $document 'Văn phòng Công ty CPVT Hoàng Minh Dũng – Chi nhánh Vĩnh Phúc' '{ten_don_vi}'
  Replace-WordText $document 'Tổ 01, Phường Phúc Yên, Tỉnh Phú Thọ' '{dia_chi_don_vi}'
  Replace-WordText $document '0104163591-001' '{ma_so_thue_don_vi}'
  Replace-WordText $document 'Nguyễn Trường Xuân' '{dai_dien_don_vi}'
  Replace-WordText $document 'Giám đốc' '{chuc_vu_dai_dien}'
  Replace-WordText $document 'Nguyễn Văn ABC' '{ho_ten_lai_xe}'
  Replace-WordText $document 'Số nhà 15, ngõ 2, Đường 3, Dược Thượng, xã Sóc Sơn, Thành phố Hà Nội' '{dia_chi_lai_xe}'
  Replace-WordText $document '001094004597' '{so_cccd}'
  Replace-WordText $document '01/01/2020' '{ngay_cap_cccd}'
  Replace-WordText $document 'CCS QLHC về TTXH' '{noi_cap_cccd}'
  Replace-WordText $document '001094004597/2025/HĐĐC' '{so_hop_dong_dat_coc}'
  Replace-WordText $document '{so_cccd}/2025/HĐĐC' '{so_hop_dong_dat_coc}'
  Replace-WordText $document '11/01/2025' '{ngay_ky_hop_dong_dat_coc}'
  Replace-WordText $document 'Bên B chấm dứt Hợp đồng lao động và đã thực hiện thủ tục nghỉ việc theo quy định của Công ty.' '{ly_do_thanh_ly}'
  Replace-WordText $document 'Bên A thanh toán cho Bên B số tiền cọc sau khi cấn trừ các khoản công nợ tồn đọng (nếu có) là: ……………..đ (Bằng chữ: …………………đồng./)' 'Bên A thanh toán cho Bên B số tiền cọc sau khi cấn trừ các khoản công nợ tồn đọng (nếu có) là: {so_tien_hoan_tra} đồng (Bằng chữ: {so_tien_hoan_tra_text} đồng).'
  Replace-WordText $document '- Hình thức thanh toán: Tiền mặt' '- Hình thức thanh toán: {hinh_thuc_thanh_toan}'

  $document.Save()
  $document.Close([ref]$false)
  $document = $null

  Write-Host "Đã tạo template Word theo mẫu gốc: $outputPath"
}
finally {
  if ($document) {
    $document.Close([ref]$false) | Out-Null
  }
  if ($word) {
    $word.Quit() | Out-Null
  }
}
