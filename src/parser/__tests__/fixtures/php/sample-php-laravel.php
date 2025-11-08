<?php
/**
 * sample-php-laravel.php
 * Laravel framework patterns and common PHP web development patterns
 */

namespace App\Http\Controllers;

use App\Models\Post;
use App\Http\Requests\StorePostRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

// ===== Controller =====

class PostController extends Controller {
    public function index() {
        $posts = Post::with('author')->latest()->paginate(15);
        return view('posts.index', compact('posts'));
    }

    public function show(int $id) {
        $post = Post::findOrFail($id);
        return view('posts.show', compact('post'));
    }

    public function store(StorePostRequest $request) {
        $validated = $request->validated();

        $post = Post::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'user_id' => Auth::id(),
        ]);

        return redirect()->route('posts.show', $post->id)
            ->with('success', 'Post created successfully');
    }

    public function update(StorePostRequest $request, int $id) {
        $post = Post::findOrFail($id);
        $post->update($request->validated());

        return redirect()->route('posts.show', $post->id)
            ->with('success', 'Post updated successfully');
    }

    public function destroy(int $id) {
        $post = Post::findOrFail($id);
        $post->delete();

        return redirect()->route('posts.index')
            ->with('success', 'Post deleted successfully');
    }
}

// ===== Eloquent Model =====

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model {
    protected $fillable = ['title', 'content', 'user_id', 'published_at'];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function author(): BelongsTo {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function comments(): HasMany {
        return $this->hasMany(Comment::class);
    }

    public function scopePublished($query) {
        return $query->whereNotNull('published_at');
    }

    public function getExcerptAttribute(): string {
        return substr(strip_tags($this->content), 0, 150) . '...';
    }
}

// ===== API Controller =====

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserApiController extends Controller {
    public function index(): JsonResponse {
        $users = User::select('id', 'name', 'email')->get();
        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    public function show(int $id): JsonResponse {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    public function store(Request $request): JsonResponse {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
        ]);

        $user = User::create($validated);

        return response()->json([
            'success' => true,
            'data' => $user,
        ], 201);
    }
}

// ===== Middleware =====

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckUserRole {
    public function handle(Request $request, Closure $next, string $role) {
        if (!$request->user()->hasRole($role)) {
            abort(403, 'Unauthorized');
        }

        return $next($request);
    }
}

class LogApiRequest {
    public function handle(Request $request, Closure $next) {
        $start = microtime(true);

        $response = $next($request);

        $duration = microtime(true) - $start;
        logger()->info('API Request', [
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'duration' => $duration,
        ]);

        return $response;
    }
}

// ===== Service Class =====

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentService {
    private $gateway;
    private $logger;

    public function __construct(PaymentGateway $gateway, LoggerInterface $logger) {
        $this->gateway = $gateway;
        $this->logger = $logger;
    }

    public function processPayment(Order $order, array $paymentData): Payment {
        DB::beginTransaction();

        try {
            $charge = $this->gateway->charge(
                $order->total,
                $paymentData['payment_method']
            );

            $payment = Payment::create([
                'order_id' => $order->id,
                'amount' => $order->total,
                'transaction_id' => $charge->id,
                'status' => 'completed',
            ]);

            $order->update(['status' => 'paid']);

            DB::commit();

            $this->logger->info("Payment processed for order {$order->id}");

            return $payment;
        } catch (\Exception $e) {
            DB::rollBack();
            $this->logger->error("Payment failed for order {$order->id}: {$e->getMessage()}");
            throw $e;
        }
    }

    public function refundPayment(Payment $payment): bool {
        $refund = $this->gateway->refund($payment->transaction_id);

        if ($refund->success) {
            $payment->update(['status' => 'refunded']);
            return true;
        }

        return false;
    }
}

// ===== Job Class =====

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWelcomeEmail implements ShouldQueue {
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $user;

    public function __construct($user) {
        $this->user = $user;
    }

    public function handle() {
        // Send email logic
        \Mail::to($this->user->email)->send(new WelcomeEmail($this->user));
    }
}

// ===== Form Request =====

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'published_at' => 'nullable|date',
        ];
    }

    public function messages(): array {
        return [
            'title.required' => 'A title is required',
            'content.required' => 'Content is required',
        ];
    }
}

?>
