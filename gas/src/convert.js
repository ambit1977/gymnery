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
