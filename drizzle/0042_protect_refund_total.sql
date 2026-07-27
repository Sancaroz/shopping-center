CREATE TRIGGER `payment_transactions_refund_limit`
BEFORE INSERT ON `payment_transactions`
WHEN NEW.`kind` = 'refund' AND NEW.`status` = 'succeeded' AND NEW.`reconciliation_status` = 'matched'
BEGIN
  SELECT CASE WHEN NEW.`amount` > (
    CASE
      WHEN (SELECT COALESCE(SUM(`amount`), 0) FROM `payment_transactions` WHERE `order_id` = NEW.`order_id` AND `kind` = 'payment' AND `status` = 'succeeded' AND `reconciliation_status` = 'matched') > 0
      THEN (SELECT COALESCE(SUM(`amount`), 0) FROM `payment_transactions` WHERE `order_id` = NEW.`order_id` AND `kind` = 'payment' AND `status` = 'succeeded' AND `reconciliation_status` = 'matched')
      ELSE COALESCE((SELECT CASE WHEN `payment_status` IN ('paid', 'partially_refunded', 'refunded') THEN `total` ELSE 0 END FROM `orders` WHERE `id` = NEW.`order_id`), 0)
    END
    - (SELECT COALESCE(SUM(`amount`), 0) FROM `payment_transactions` WHERE `order_id` = NEW.`order_id` AND `kind` = 'refund' AND `status` = 'succeeded' AND `reconciliation_status` = 'matched')
    + 0.004
  ) THEN RAISE(ABORT, 'refund_exceeds_captured') END;
END;
