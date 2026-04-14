export default function handler(req, res) {
  const { token, key, number, amount } = req.query;

  if (token !== "UFCJYD2Q" || key !== "WvNnEmlFhpfpW5JX") {
    return res.status(401).json({
      status: "failed",
      message: "Invalid Token"
    });
  }

  if (!number || number.length < 10) {
    return res.json({
      status: "failed",
      message: "Invalid Number"
    });
  }

  if (!amount || parseFloat(amount) <= 0) {
    return res.json({
      status: "failed",
      message: "Invalid Amount"
    });
  }

  return res.json({
    status: "success",
    txn_id: "TXN" + Date.now(),
    message: "Demo Payment Success"
  });
}
