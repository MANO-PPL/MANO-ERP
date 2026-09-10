"""Provider and model capability profiles for MANO ERP Agent reasoning.

Decouples agent execution from any single model or provider and defines
explicit capability constraints: tool planning vs final synthesis, native tool
calling vs strict JSON schema, token budgets, reasoning flags, and retry rules.
"""
from dataclasses import dataclass
from typing import Dict, FrozenSet, Literal, Optional
import os
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.env")))

ProviderType = Literal["groq", "nvidia"]
InteractionMode = Literal["planning", "synthesis"]

RETRYABLE_STATUSES: FrozenSet[int] = frozenset({413, 429, 500, 502, 503, 504})
NON_RETRYABLE_STATUSES: FrozenSet[int] = frozenset({400, 401, 403, 404, 410, 422})


@dataclass(frozen=True)
class ModelProfile:
    """Capability and constraint declaration for an AI provider/model."""
    name: str
    provider: ProviderType
    model: str
    supported_modes: FrozenSet[InteractionMode]
    native_tools: bool
    strict_json_schema: bool
    max_input_tokens: int
    max_output_tokens: int
    supports_reasoning: bool
    reasoning_effort: Optional[str] = None
    retryable_statuses: FrozenSet[int] = RETRYABLE_STATUSES
    max_retries: int = 1

    def supports_mode(self, mode: InteractionMode) -> bool:
        return mode in self.supported_modes

    def is_retryable_status(self, status_code: int) -> bool:
        return status_code in self.retryable_statuses


def _build_registry() -> Dict[str, ModelProfile]:
    """Build configurable profiles from environment variables."""
    groq_model = os.getenv("GROQ_AGENT_MODEL", "qwen/qwen3.8-27b")
    groq_fallback = os.getenv("GROQ_FALLBACK_MODEL", "openai/gpt-oss-120b")
    nvidia_model = os.getenv("NVIDIA_AGENT_MODEL", "openai/gpt-oss-20b")

    profiles: Dict[str, ModelProfile] = {
        # Primary read profile on Groq: supports native tool calls + JSON synthesis,
        # reasoning_effort="none" ensures no hidden reasoning tokens consume budget.
        "groq-qwen": ModelProfile(
            name="groq-qwen",
            provider="groq",
            model=groq_model,
            supported_modes=frozenset({"planning", "synthesis"}),
            native_tools=True,
            strict_json_schema=True,
            max_input_tokens=int(os.getenv("GROQ_MAX_INPUT_TOKENS", "7000")),
            max_output_tokens=2048,
            supports_reasoning=True,
            reasoning_effort="none",
            max_retries=1,
        ),
        # Fallback read synthesis profile on Groq: separate 8,000 TPM rate-limit bucket,
        # structured JSON output mode, reserved for user-facing synthesis.
        "groq-oss-120b": ModelProfile(
            name="groq-oss-120b",
            provider="groq",
            model=groq_fallback,
            supported_modes=frozenset({"planning", "synthesis"}),
            native_tools=False,
            strict_json_schema=False,
            max_input_tokens=8000,
            max_output_tokens=2048,
            supports_reasoning=False,
            reasoning_effort=None,
            max_retries=1,
        ),
        # Alternative Groq profile for synthesis or lower context usage
        "groq-oss-20b": ModelProfile(
            name="groq-oss-20b",
            provider="groq",
            model="openai/gpt-oss-20b",
            supported_modes=frozenset({"synthesis"}),
            native_tools=False,
            strict_json_schema=False,
            max_input_tokens=8000,
            max_output_tokens=2048,
            supports_reasoning=False,
            reasoning_effort=None,
            max_retries=1,
        ),
        # NVIDIA NIM profile: default for write operations and NVIDIA environments
        "nvidia-gpt-oss": ModelProfile(
            name="nvidia-gpt-oss",
            provider="nvidia",
            model=nvidia_model,
            supported_modes=frozenset({"planning", "synthesis"}),
            native_tools=False,
            strict_json_schema=False,
            max_input_tokens=16000,
            max_output_tokens=4096,
            supports_reasoning=True,
            reasoning_effort="low",
            max_retries=1,
        ),
    }
    return profiles


PROFILES = _build_registry()


def get_profile(name: str) -> ModelProfile:
    """Retrieve a profile by name with fallback to groq-qwen."""
    if name not in PROFILES:
        raise ValueError(f"Unknown agent model profile: '{name}'")
    return PROFILES[name]


def get_read_primary_profile() -> ModelProfile:
    """Return the configured primary read profile."""
    profile_name = os.getenv("AGENT_READ_PRIMARY_PROFILE", "groq-qwen")
    return PROFILES.get(profile_name, PROFILES["groq-qwen"])


def get_read_fallback_profile() -> Optional[ModelProfile]:
    """Return the configured read fallback profile, or None if disabled."""
    profile_name = os.getenv("AGENT_READ_FALLBACK_PROFILE", "groq-oss-120b")
    if not profile_name or profile_name.lower() in {"none", "disabled", "false"}:
        return None
    return PROFILES.get(profile_name)


def get_write_profile() -> ModelProfile:
    """Return the dedicated write profile (isolated from read profiles)."""
    default_profile = "groq-qwen" if not os.getenv("NVIDIA_API_KEY") else "nvidia-gpt-oss"
    profile_name = os.getenv("AGENT_WRITE_PROFILE", default_profile)
    return PROFILES.get(profile_name, PROFILES["groq-qwen"])


def is_retryable_failure(category: str, http_status: Optional[int] = None) -> bool:
    """Determine if an observed failure should trigger a retry/fallback."""
    if http_status is not None:
        if http_status in NON_RETRYABLE_STATUSES:
            return False
        if http_status in RETRYABLE_STATUSES:
            return True
    return category in {
        "provider_transport_failure",
        "provider_http_failure",
        "network_failure",
        "timeout",
        "rate_limit",
    }
