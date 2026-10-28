import { supabase } from '@/lib/supabase';

// Self-verify via mock M-Pesa payment.
export const selfVerify = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('bg_self_verify');
    return !error;
  } catch {
    return false;
  }
};

// Withdrawal math: 1 coin = 1 KES. Min 200 coins.
// User gets 80% (160 KES), platform fee 40 KES (20%).
export const WITHDRAW_MIN_COINS = 200;
export const WITHDRAW_FEE_KES = 40;
export const WITHDRAW_RATE = 0.8; // user gets 80% of coin value

export const calcWithdrawPayout = (coins: number): { toUser: number; fee: number } => ({
  toUser: Math.round(coins * WITHDRAW_RATE),
  fee: WITHDRAW_FEE_KES,
});

// Request a withdrawal. Returns the created row or null.
export const requestWithdrawal = async (coins: number, phone: string) => {
  const { toUser, fee } = calcWithdrawPayout(coins);
  const { data, error } = await supabase
    .from('bg_withdrawals')
    .insert({ coins, kes_to_user: toUser, kes_fee: fee, phone })
    .select('*')
    .single();
  if (error) return null;
  return data;
};

// Record an ad payment (advertiser sub or ad coin purchase).
export const recordAdPayment = async (
  type: 'ad_sub' | 'ad_coins',
  amountKes: number,
  coins: number,
  mpesaCode: string,
  screenshotUrl: string,
) => {
  const { error } = await supabase
    .from('bg_payments')
    .insert({ type, amount_kes: amountKes, coins, mpesa_code: mpesaCode, screenshot_url: screenshotUrl });
  return !error;
};
