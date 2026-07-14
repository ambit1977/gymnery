function convertUTCToJST() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. sessions シートの変換 (C列:開始日時, D列:終了日時)
  const sessionsSheet = ss.getSheetByName('sessions');
  if (sessionsSheet) {
    const lastRow = sessionsSheet.getLastRow();
    if (lastRow > 1) {
      const range = sessionsSheet.getRange(2, 3, lastRow - 1, 2);
      const values = range.getValues();
      const updatedValues = values.map(row => {
        return [
          formatToJST(row[0]), // 開始日時 (C列)
          formatToJST(row[1])  // 終了日時 (D列)
        ];
      });
      range.setValues(updatedValues);
      console.log('sessions シートの日時変換が完了しました。');
    }
  }
  
  // 2. exercises シートの変換 (J列:記録日時)
  const exercisesSheet = ss.getSheetByName('exercises');
  if (exercisesSheet) {
    const lastRow = exercisesSheet.getLastRow();
    if (lastRow > 1) {
      const range = exercisesSheet.getRange(2, 10, lastRow - 1, 1);
      const values = range.getValues();
      const updatedValues = values.map(row => {
        return [formatToJST(row[0])]; // 記録日時 (J列)
      });
      range.setValues(updatedValues);
      console.log('exercises シートの日時変換が完了しました。');
    }
  }
  
  Browser.msgBox('完了', 'UTCから日本時間(JST)への一括変換が完了しました。', Browser.Buttons.OK);
}

// スプレッドシート上の過去の重複データを一括クリーンアップする専用関数
function cleanDuplicateRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sessionsCleaned = 0;
  let exercisesCleaned = 0;

  // 1. sessions シートの重複削除 (A列: ID 重複)
  const sessionsSheet = ss.getSheetByName('sessions');
  if (sessionsSheet) {
    const lastRow = sessionsSheet.getLastRow();
    if (lastRow > 1) {
      const before = lastRow;
      sessionsSheet.getRange(2, 1, lastRow - 1, sessionsSheet.getLastColumn()).removeDuplicates([1]);
      sessionsCleaned = before - sessionsSheet.getLastRow();
      console.log(`sessions シート: ${sessionsCleaned}件の重複を削除しました。`);
    }
  }

  // 2. exercises シートの重複削除 (B列: セッションID & C列: マシンID 重複)
  const exercisesSheet = ss.getSheetByName('exercises');
  if (exercisesSheet) {
    const lastRow = exercisesSheet.getLastRow();
    if (lastRow > 1) {
      const before = lastRow;
      exercisesSheet.getRange(2, 1, lastRow - 1, exercisesSheet.getLastColumn()).removeDuplicates([2, 3]);
      exercisesCleaned = before - exercisesSheet.getLastRow();
      console.log(`exercises シート: ${exercisesCleaned}件の重複を削除しました。`);
    }
  }

  Browser.msgBox('完了', `重複行のクリーンアップが完了しました。\n\nsessions: ${sessionsCleaned} 行削除\nexercises: ${exercisesCleaned} 行削除`, Browser.Buttons.OK);
}

// UTC(TやZを含む文字列)を検知して日本時間に変換するヘルパー
function formatToJST(val) {
  if (!val) return '';
  const str = String(val).trim();
  
  // ISO8601形式（TやZが含まれる）の場合のみ日本時間に変換する
  if (str.includes('T') || str.includes('Z')) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      // JST (Asia/Tokyo) タイムゾーンでフォーマット
      return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    }
  }
  return val; // すでに変換済み(または通常テキスト)の場合はそのまま返す
}
