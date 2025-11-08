<?php
/**
 * sample-php-advanced.php
 * Advanced PHP patterns including namespaces, type hints, and modern PHP features
 */

namespace App\Services;

use App\Models\User;
use App\Models\Order;
use Illuminate\Support\Collection;

// ===== Namespaced Classes =====

class OrderService {
    private $repository;
    private $logger;

    public function __construct(OrderRepository $repository, LoggerInterface $logger) {
        $this->repository = $repository;
        $this->logger = $logger;
    }

    public function createOrder(User $user, array $items): Order {
        $order = new Order();
        $order->user_id = $user->id;
        $order->items = $items;
        $order->total = $this->calculateTotal($items);

        $this->repository->save($order);
        $this->logger->info("Order created: {$order->id}");

        return $order;
    }

    private function calculateTotal(array $items): float {
        return array_reduce($items, function ($carry, $item) {
            return $carry + ($item['price'] * $item['quantity']);
        }, 0.0);
    }

    public function cancelOrder(int $orderId): bool {
        $order = $this->repository->find($orderId);

        if (!$order) {
            throw new OrderNotFoundException("Order not found: $orderId");
        }

        $order->status = 'cancelled';
        $this->repository->save($order);

        return true;
    }
}

// ===== Typed Properties (PHP 7.4+) =====

class Customer {
    private int $id;
    private string $name;
    private string $email;
    private ?string $phone;
    private array $orders;

    public function __construct(int $id, string $name, string $email) {
        $this->id = $id;
        $this->name = $name;
        $this->email = $email;
        $this->phone = null;
        $this->orders = [];
    }

    public function getId(): int {
        return $this->id;
    }

    public function getName(): string {
        return $this->name;
    }

    public function setPhone(?string $phone): void {
        $this->phone = $phone;
    }

    public function addOrder(Order $order): void {
        $this->orders[] = $order;
    }
}

// ===== Repository Pattern =====

class OrderRepository {
    private $connection;

    public function __construct(DatabaseConnection $connection) {
        $this->connection = $connection;
    }

    public function find(int $id): ?Order {
        $result = $this->connection->query("SELECT * FROM orders WHERE id = ?", [$id]);
        return $result ? $this->hydrate($result) : null;
    }

    public function save(Order $order): bool {
        if ($order->id) {
            return $this->update($order);
        } else {
            return $this->insert($order);
        }
    }

    private function hydrate(array $data): Order {
        $order = new Order();
        $order->id = $data['id'];
        $order->user_id = $data['user_id'];
        $order->total = $data['total'];
        return $order;
    }

    private function insert(Order $order): bool {
        // Insert logic
        return true;
    }

    private function update(Order $order): bool {
        // Update logic
        return true;
    }
}

// ===== Static Methods =====

class StringHelper {
    public static function slugify(string $text): string {
        $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
        return strtolower(trim($text, '-'));
    }

    public static function truncate(string $text, int $length = 100): string {
        if (strlen($text) <= $length) {
            return $text;
        }
        return substr($text, 0, $length) . '...';
    }

    public static function camelCase(string $text): string {
        return lcfirst(str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $text))));
    }
}

// ===== Enums (PHP 8.1+) - Simulated with constants =====

class OrderStatus {
    const PENDING = 'pending';
    const PROCESSING = 'processing';
    const SHIPPED = 'shipped';
    const DELIVERED = 'delivered';
    const CANCELLED = 'cancelled';

    public static function all(): array {
        return [
            self::PENDING,
            self::PROCESSING,
            self::SHIPPED,
            self::DELIVERED,
            self::CANCELLED,
        ];
    }
}

// ===== Anonymous Functions / Closures =====

class EventDispatcher {
    private $listeners = [];

    public function on(string $event, callable $callback): void {
        if (!isset($this->listeners[$event])) {
            $this->listeners[$event] = [];
        }
        $this->listeners[$event][] = $callback;
    }

    public function dispatch(string $event, $data = null): void {
        if (!isset($this->listeners[$event])) {
            return;
        }

        foreach ($this->listeners[$event] as $callback) {
            $callback($data);
        }
    }
}

// ===== Magic Methods =====

class Model {
    private $attributes = [];

    public function __get($name) {
        return $this->attributes[$name] ?? null;
    }

    public function __set($name, $value) {
        $this->attributes[$name] = $value;
    }

    public function __isset($name) {
        return isset($this->attributes[$name]);
    }

    public function __toString() {
        return json_encode($this->attributes);
    }
}

?>
