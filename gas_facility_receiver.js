/**
 * Gymnery 施設データ受付 Google Apps Script (GAS)
 * 
 * 【セットアップ手順 (約2分)】
 * 1. Google ドライブで「新規」>「Google スプレッドシート」を作成
 * 2. メニュー「拡張機能」>「Apps Script」を開く
 * 3. このコードを貼り付けて保存
 * 4. 右上の「デプロイ」>「新しいデプロイ」
 *    - 種類の選択:「ウェブアプリ」
 *    - 次のユーザーとして実行:「自分」
 *    - アクセスできるユーザー:「全員 (Anyone)」
 * 5. 発行された「ウェブアプリの URL」をアプリの設定またはコードに登録
 */

function doPost(e) {
  try {
    const rawData = e.postData.contents;
    const data = JSON.parse(rawData);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('施設提案プール');
    if (!sheet) {
      sheet = ss.insertSheet('施設提案プール');
      sheet.appendRow(['受付日時', '施設ID', '施設名', '送信者名', 'コメント', 'マシン台数', '完全設定JSON']);
      sheet.getRange(1, 1, 1, 7).setBackground('#4ecdc4').setFontColor('#ffffff').setFontWeight('bold');
    }

    const machineCount = (data.facilityData && data.facilityData.machines) ? data.facilityData.machines.length : 0;
    const jsonStr = JSON.stringify(data.facilityData, null, 2);

    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      data.facilityId || '',
      data.facilityName || '',
      data.nickname || '匿名',
      data.comment || '',
      machineCount,
      jsonStr
    ]);

    // GitHub Issue への自動起票 (オプション: Script Properties に GITHUB_PAT がある場合)
    const githubToken = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT');
    const githubRepo = PropertiesService.getScriptProperties().getProperty('GITHUB_REPO') || 'ambit1977/gymnery';
    
    if (githubToken) {
      createGitHubIssue(githubRepo, githubToken, data);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Facility data received' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function createGitHubIssue(repo, token, data) {
  const url = 'https://api.github.com/repos/' + repo + '/issues';
  const title = '[Facility Proposal] ' + (data.facilityName || data.facilityId) + ' のマシン情報更新';
  const body = '### 施設データ更新提案 🏋️\n\n' +
    '- **施設名**: ' + data.facilityName + '\n' +
    '- **施設ID**: ' + data.facilityId + '\n' +
    '- **送信者**: ' + data.nickname + '\n' +
    '- **コメント**: ' + (data.comment || '(なし)') + '\n' +
    '- **マシン台数**: ' + ((data.facilityData && data.facilityData.machines) ? data.facilityData.machines.length : 0) + ' 台\n\n' +
    '#### 提案 JSON データ:\n```json\n' + JSON.stringify(data.facilityData, null, 2) + '\n```';

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gymnery-GAS-Bot'
    },
    contentType: 'application/json',
    payload: JSON.stringify({
      title: title,
      body: body,
      labels: ['facility-proposal', 'community']
    }),
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch(url, options);
}
