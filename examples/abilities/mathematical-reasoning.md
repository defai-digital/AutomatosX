# Mathematical Reasoning

## Description
Rigorous mathematical analysis capabilities spanning linear algebra, calculus, probability, numerical methods, and symbolic reasoning to support research-grade problem solving, model verification, and algorithm design for Bob and Data Scientist while powering Quinn and Astrid workflows.

## Core Domains

### 1. Linear Algebra
- Matrix algebra (addition, multiplication, transposition, trace/determinant)
- Eigenvalue and eigenvector computation (power iteration, QR algorithm)
- Singular value decomposition, low-rank approximations, and PCA linkage
- Vector spaces, basis transformations, orthogonality, and projections
- Positive definiteness checks, conditioning, and spectral properties

```python
import numpy as np

A = np.array([[4., 2.], [1., 3.]])

eigvals, eigvecs = np.linalg.eig(A)
u, s, vt = np.linalg.svd(A)
proj = A @ np.linalg.solve(A.T @ A, A.T)  # Least-squares projector

cond_number = np.linalg.cond(A)
```

### 2. Calculus & Optimization
- Differential calculus, gradients, Jacobians, Hessians
- Line search, Newton, quasi-Newton, and trust-region methods
- Constrained optimization (KKT conditions, Lagrange multipliers)
- Convex analysis, duality, strong/weak convexity checks
- Sensitivity analysis and automatic differentiation workflows

```python
import sympy as sp

x, y = sp.symbols('x y', real=True)
f = (x - 2)**2 + (y + 1)**2 + 3 * x * y
grad = [sp.diff(f, var) for var in (x, y)]
hessian = sp.hessian(f, (x, y))

λ = sp.symbols('λ')
constraint = x + y - 1
lagrangian = f + λ * constraint
kkt_eqs = [sp.diff(lagrangian, var) for var in (x, y, λ)]
solution = sp.solve(kkt_eqs, (x, y, λ), dict=True)
```

### 3. Probability & Statistics
- Probability distributions (continuous/discrete), conjugacy, transformations
- Bayesian inference (posterior computation, MAP/MCMC, credible intervals)
- Frequentist inference (hypothesis tests, p-values, confidence intervals)
- Estimators, bias-variance trade-offs, sufficiency, asymptotics
- Information measures (entropy, KL divergence, mutual information)

```python
import numpy as np
from scipy import stats

# Bayesian update for Beta-Binomial model
prior_a, prior_b = 2, 2
successes, trials = 18, 25
posterior = stats.beta(prior_a + successes, prior_b + trials - successes)
cred_interval = posterior.interval(0.95)
evidence = stats.binom.pmf(successes, trials, prior_a / (prior_a + prior_b))

# Frequentist hypothesis test
sample = np.random.normal(loc=1.05, scale=0.2, size=40)
t_stat, p_value = stats.ttest_1samp(sample, popmean=1.0)
```

### 4. Numerical Methods
- Numerical integration (Gaussian quadrature, adaptive Simpson)
- Root finding (Newton-Raphson, secant, bracketing methods)
- ODE/PDE solvers (Runge-Kutta, implicit schemes, finite differences)
- Stability and convergence analysis, stiffness diagnostics
- Error bounds, conditioning, floating-point safeguards

```python
import numpy as np
from scipy.integrate import quad, solve_ivp

area, err = quad(lambda t: np.exp(-t**2), 0, np.inf)

def logistic(t, y, r=1.2, K=10.0):
    return r * y * (1 - y / K)

solution = solve_ivp(logistic, (0, 20), [0.5], method="RK45", dense_output=True)
stability = np.max(np.abs(np.linalg.eigvals([[0., 1.], [-4., -1.5]])))
```

### 5. Symbolic Computation
- Formal manipulations (simplification, expansion, factorization)
- Symbolic integration/differentiation and series expansions
- Proof assistants for identity verification and equivalence checking
- Symbolic linear algebra, polynomial resultants, Groebner bases
- Derivation tracing with justification for documentation and review

```python
import sympy as sp

t = sp.symbols('t', positive=True)
series = sp.series(sp.sin(t) / t, t, 0, 6)
identity = sp.simplify(sp.exp(sp.I * t) * sp.exp(-sp.I * t))
proof = sp.Eq(sp.diff(sp.log(sp.factorial(t)), t), sp.digamma(t + 1))

M = sp.Matrix([[1, 2], [3, 4]])
eigen_decomp = M.eigenvects()
```

### 6. Mathematical Verification Notebooks
- Structured Python notebooks using NumPy, SciPy, and SymPy for reproducible math experiments
- Cells organized by assumptions → derivations → numerical validation → sensitivity checks
- Parameterized widgets or YAML configs for scenario sweeps
- Automatic assertion blocks to verify algebraic vs. numeric equivalence
- Version-controlled notebooks (`.ipynb` or `.py` using Jupytext) with deterministic seeds

```python
# verification_notebook.py (Jupytext style)
import numpy as np
import sympy as sp
from scipy.optimize import minimize

np.random.seed(42)
w = sp.symbols('w')
symbolic_grad = sp.diff(sp.sin(w) + w**2, w)

def objective(val):
    return np.sin(val) + val**2

res = minimize(objective, x0=[0.5])
assert abs(symbolic_grad.subs({w: res.x[0]}) - 0) < 1e-6
```

## Best Practices
1. **State Assumptions Explicitly**: Document domains, constraints, and approximation regimes before derivations.
2. **Cross-Validate**: Confirm symbolic results with numerical experiments (Monte Carlo, sampling, discretization).
3. **Track Units and Scaling**: Maintain dimensional consistency and rescale ill-conditioned problems.
4. **Monitor Conditioning**: Inspect condition numbers and step sizes to pre-empt numerical instability.
5. **Use Reproducible Seeds**: Fix random seeds and record solver tolerances for repeatability.
6. **Validate Constraints**: Ensure solution candidates satisfy KKT or feasibility conditions post-optimization.

## Common Workflows
- Analytical derivation with SymPy → numerical verification via SciPy → documentation in notebook with Markdown proof steps.
- Linear algebra pipelines converting symbolic expressions to callable NumPy functions for high-performance evaluation.
- Bayesian model evaluation combining closed-form posteriors with MCMC diagnostics when conjugacy fails.
- PDE prototyping using finite differences followed by spectral method comparison for convergence profiling.

## Anti-patterns to Avoid
1. ❌ Treating floating-point equality as exact; always compare with tolerance windows.
2. ❌ Ignoring solver diagnostics (residual norms, iteration counts, Jacobian approximations).
3. ❌ Skipping preconditioning for stiff or ill-conditioned linear systems.
4. ❌ Mixing symbolic and numeric domains without explicit casting, leading to type errors or performance hits.
5. ❌ Assuming convergence without verifying gradients/Hessians or constraint satisfaction.

## Tooling & References
- **Core Libraries**: NumPy, SciPy, SymPy, JAX, PyTorch (autograd), cvxpy
- **Notebooks**: JupyterLab, VS Code notebooks, Jupytext for `.py` parity
- **Visualization**: Matplotlib, Plotly, seaborn for residuals and convergence plots
- **Verification**: hypothesis for property-based testing, pytest for deterministic assertions
- **Resources**: Matrix Cookbook, Boyd & Vandenberghe’s Convex Optimization, Numerical Recipes, Probabilistic Machine Learning (Murphy)

## Quick Checklist
- [ ] Assumptions and variable domains documented
- [ ] Symbolic derivations simplified and verified numerically
- [ ] Conditioning and stability assessed with diagnostics
- [ ] Optimization routines include gradient/Hessian validation
- [ ] Probabilistic models report uncertainty (CI or posterior summaries)
- [ ] Notebooks or scripts captured in version control with reproducible seeds

