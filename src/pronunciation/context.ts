import { createContext, useContext } from "react";

export interface AzureStatus {
  region: string;
  enabled: boolean;
  has_key: boolean;
  month: string;
  month_seconds: number;
}

export interface Assessment {
  accuracy: number;
  fluency: number;
  completeness: number;
  total: number;
  low_words: { word: string; accuracy: number }[];
  month_seconds: number;
}

export interface AzureContextValue {
  status: AzureStatus | null;
  loadError?: boolean;
  save(region: string, key: string, enabled: boolean): Promise<void>;
  clearKey(): Promise<void>;
  testConnection(): Promise<void>;
  assess(blob: Blob, reference: string): Promise<Assessment>;
}

export const AzureContext = createContext<AzureContextValue | null>(null);

export function useAzure(): AzureContextValue {
  const ctx = useContext(AzureContext);
  if (!ctx) throw new Error("useAzure must be used inside AzureProvider");
  return ctx;
}

export interface AzureErrorPayload {
  code?: string;
  retry_after?: number;
}

export function azureErrorMessage(error: unknown): string {
  const value = error as AzureErrorPayload | undefined;
  const code = value?.code ?? (error instanceof Error ? error.message : undefined);
  switch (code) {
    case "missing_key":
      return "请先填写并保存 Azure 密钥。";
    case "region":
      return "区域格式不对，请填写 Azure 资源的区域代码，例如 westeurope。";
    case "invalid_key":
      return "密钥或区域不正确，请核对后重试。";
    case "rate_limited":
      return `请求太频繁，请 ${value?.retry_after ?? 60} 秒后再评分。`;
    case "no_speech":
      return "没有听清这次录音，请靠近麦克风再录一次。";
    case "audio":
    case "audio_length":
      return "录音时长或格式不适合评分，请重新录一次。";
    case "audio_unsupported":
      return "这台电脑暂时无法转换录音格式。";
    case "network":
      return "暂时连不上 Azure，请检查网络后再试。";
    case "disabled":
      return "请先在设置中开启发音评分。";
    case "storage":
      return "本机评分设置无法读取或保存，请稍后再试。";
    case "reference":
      return "请选择一条参考答案再评分。";
    case "response":
      return "Azure 暂时没有返回评分，请稍后再试。";
    case "service":
      return "Azure 评分服务暂时不可用，请稍后再试。";
    default:
      return "评分暂时不可用，请稍后再试。";
  }
}
