<?php
/**
 * sample-php-basic.php
 * Basic PHP patterns for parser testing
 */

// ===== Functions =====

function calculateTotal($items) {
    $sum = 0;
    foreach ($items as $item) {
        $sum += $item['price'];
    }
    return $sum;
}

function formatCurrency(float $amount): string {
    return '$' . number_format($amount, 2);
}

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// ===== Classes =====

class Calculator {
    private $history = [];

    public function add($a, $b) {
        $result = $a + $b;
        $this->history[] = "add: $a + $b = $result";
        return $result;
    }

    public function subtract($a, $b) {
        $result = $a - $b;
        $this->history[] = "subtract: $a - $b = $result";
        return $result;
    }

    public function getHistory() {
        return $this->history;
    }
}

class Product {
    public $name;
    public $price;
    protected $sku;
    private $stock;

    public function __construct(string $name, float $price) {
        $this->name = $name;
        $this->price = $price;
    }

    public function isInStock(): bool {
        return $this->stock > 0;
    }
}

// ===== Constants =====

const APP_VERSION = '2.0.0';
const STATUS_ACTIVE = 1;
const STATUS_INACTIVE = 0;

// ===== Interfaces =====

interface PaymentGateway {
    public function charge(float $amount): bool;
    public function refund(string $transactionId): bool;
}

interface Loggable {
    public function log(string $message): void;
}

// ===== Abstract Classes =====

abstract class BaseController {
    protected $request;
    protected $response;

    abstract public function handle();

    public function setRequest($request) {
        $this->request = $request;
    }
}

// ===== Traits =====

trait Timestampable {
    protected $createdAt;
    protected $updatedAt;

    public function touch() {
        $this->updatedAt = time();
    }
}

trait Sluggable {
    public function generateSlug(string $text): string {
        return strtolower(str_replace(' ', '-', $text));
    }
}

// ===== Class using Traits =====

class Post {
    use Timestampable, Sluggable;

    public $title;
    public $content;

    public function publish() {
        $this->touch();
        // Publishing logic here
    }
}

?>
