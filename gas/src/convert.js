function convertUTCToJST() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. sessions シートの重複削除 & 変換 (C列:開始日時, D列:終了日時)
  const sessionsSheet = ss.getSheetByName('sessions');
  if (sessionsSheet) {
    const lastRow = sessionsSheet.getLastRow();
    if (lastRow > 1) {
      // A列(1): ID が重複している行を削除
      sessionsSheet.getRange(2, 1, lastRow - 1, sessionsSheet.getLastColumn()).removeDuplicates([1]);
      
      const newLastRow = sessionsSheet.getLastRow();
      const range = sessionsSheet.getRange(2, 3, newLastRow - 1, 2);
      const values = range.getValues();
      const updatedValues = values.map(row => {
        return [
          formatToJST(row[0]), // 開始日時 (C列)
          formatToJST(row[1])  // 終了日時 (D列)
        ];
      });
      range.setValues(updatedValues);
      console.log('sessions シートの重複削除と日時変換が完了しました。');
    }
  }
  
  // 2. exercises シートの重複削除 & 変換 (J列:記録日時)
  const exercisesSheet = ss.getSheetByName('exercises');
  if (exercisesSheet) {
    const lastRow = exercisesSheet.getLastRow();
    if (lastRow > 1) {
      // B列(2): セッションID と C列(3): マシンID が両方重複している行をクリーンアップ
      exercisesSheet.getRange(2, 1, lastRow - 1, exercisesSheet.getLastColumn()).removeDuplicates([2, 3]);
      
      const newLastRow = exercisesSheet.getLastRow();
      const range = exercisesSheet.getRange(2, 10, newLastRow - 1, 1);
      const values = range.getValues();
      const updatedValues = values.map(row => {
        return [formatToJST(row[0])]; // 記録日時 (J列)
      });
      range.setValues(updatedValues);
      console.log('exercises シートの重複削除と日時変換が完了しました。');
    }
  }
  
  Browser.msgBox('完了', 'スプシ上の重複データの削除と、日本時間(JST)への変換が完了しました。', Browser.Buttons.OK);
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
