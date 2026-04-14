export default function handler(req, res) {
  const { token, key, number, amount } = req.query;

  // 🔐 Security check
  if (token !== "UFCJYD2Q" || key !== "WvNnEmlFhpfpW5JX") {
    return res.status(401).json({
      status: "failed",
      message: "Invalid Token or Key"
    });
  }

  // 📲 Validate number
  if (!number || number.length < 10) {
    return res.json({
      status: "failed",
      message: "Invalid Number"
    });
  }

  // 💵 Validate amount
  if (!amount || parseFloat(amount) <= 0) {
    return res.json({
      status: "failed",
      message: "Invalid Amount"
    });
  }

  // 🎯 DEMO LOGIC (you can change later)
  let success = Math.random() > 0.2;

  if (success) {
    return res.json({
      status: "success",
      txn_id: "TXN" + Date.now(),
      number: number,
      amount: amount,
      message: "Payment Sent Successfully"
    });
  } else {
    return res.json({
      status: "failed",
      message: "Server Balance Low"
    });
  }
}
