
import { TelegramConfig } from '../types';

export const sendTelegramMessage = async (config: TelegramConfig, text: string): Promise<{ success: boolean; message: string }> => {
  if (!config.botToken || !config.chatId) {
    return { success: false, message: "Thiếu Bot Token hoặc Chat ID." };
  }

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    
    if (data.ok) {
      return { success: true, message: "Đã gửi thông báo thành công!" };
    } else {
      return { success: false, message: `Lỗi Telegram: ${data.description}` };
    }
  } catch (error) {
    console.error("Telegram send error:", error);
    return { success: false, message: "Không thể kết nối tới Telegram API." };
  }
};
