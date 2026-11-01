import { WalletService } from "../src/modules/wallet/wallet.service";
describe("delegated wallet", () => {
  const service = new WalletService();
  it("reports delegation without calling the wallet CLI", () => {
    expect(service.status()).toEqual({ status: "DELEGATED", login: null });
  });
  it("refuses sign-in and live balances", () => {
    expect(() => service.signin()).toThrow(
      expect.objectContaining({ code: "WALLET_DELEGATED" }),
    );
    expect(() => service.overview()).toThrow(
      expect.objectContaining({ code: "WALLET_DELEGATED" }),
    );
  });
});
