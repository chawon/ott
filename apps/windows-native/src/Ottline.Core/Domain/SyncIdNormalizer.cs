using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Ottline.Core.Models;

namespace Ottline.Core.Domain;

/// <summary>
/// Deterministic UUID v5 normalization, server provider mapping, and cross-device title matching
/// for the shared /api/sync/push and /api/sync/pull contract.
/// </summary>
public static class SyncIdNormalizer
{
    // Fixed RFC 4122 DNS-style namespace for deterministic Windows local ID -> UUID conversion.
    private static readonly Guid NamespaceId = Guid.Parse("7d5c6209-9d51-4b28-9202-4f9a66b3a5f1");

    public static bool IsValidUuid(string? rawId) =>
        !string.IsNullOrWhiteSpace(rawId) && Guid.TryParse(rawId.Trim(), out _);

    /// <summary>
    /// Returns true strictly when <paramref name="localLogId"/> and <paramref name="serverLogId"/>
    /// identify the exact same log record — either identical IDs/UUIDs or a legacy non-UUID local ID
    /// whose deterministic UUID v5 matches the canonical server UUID. Never matches two distinct UUIDs
    /// or unrelated records that merely share a title.
    /// </summary>
    public static bool IsSameLogIdentity(string? localLogId, string? serverLogId)
    {
        if (string.IsNullOrWhiteSpace(localLogId) || string.IsNullOrWhiteSpace(serverLogId))
        {
            return false;
        }

        var localTrimmed = localLogId.Trim();
        var serverTrimmed = serverLogId.Trim();
        if (string.Equals(localTrimmed, serverTrimmed, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (Guid.TryParse(localTrimmed, out var localGuid) &&
            Guid.TryParse(serverTrimmed, out var serverGuid))
        {
            return localGuid == serverGuid;
        }

        return !IsValidUuid(localTrimmed) &&
               Guid.TryParse(serverTrimmed, out var canonicalServerGuid) &&
               CreateDeterministicUuid(localTrimmed) == canonicalServerGuid;
    }

    public static string EnsureUuid(string? rawId)
    {
        var trimmed = rawId?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return Guid.NewGuid().ToString("D");
        }

        if (Guid.TryParse(trimmed, out var parsed))
        {
            return parsed.ToString("D");
        }

        return CreateDeterministicUuid(trimmed).ToString("D");
    }

    public static Guid CreateDeterministicUuid(string input)
    {
        var nsBytes = NamespaceId.ToByteArray();
        SwapGuidByteOrder(nsBytes);

        var nameBytes = Encoding.UTF8.GetBytes(input);
        var buffer = new byte[nsBytes.Length + nameBytes.Length];
        Buffer.BlockCopy(nsBytes, 0, buffer, 0, nsBytes.Length);
        Buffer.BlockCopy(nameBytes, 0, buffer, nsBytes.Length, nameBytes.Length);

        var hash = SHA256.HashData(buffer);
        var guidBytes = new byte[16];
        Array.Copy(hash, 0, guidBytes, 0, 16);

        // Set RFC 4122 version 5 (name-based) and variant bits
        guidBytes[6] = (byte)((guidBytes[6] & 0x0F) | 0x50);
        guidBytes[8] = (byte)((guidBytes[8] & 0x3F) | 0x80);

        SwapGuidByteOrder(guidBytes);
        return new Guid(guidBytes);
    }

    private static void SwapGuidByteOrder(byte[] guid)
    {
        (guid[0], guid[3]) = (guid[3], guid[0]);
        (guid[1], guid[2]) = (guid[2], guid[1]);
        (guid[4], guid[5]) = (guid[5], guid[4]);
        (guid[6], guid[7]) = (guid[7], guid[6]);
    }

    public static string NormalizeServerProvider(string? rawProvider) => rawProvider?.Trim().ToUpperInvariant() switch
    {
        "TMDB" => "TMDB",
        "KAKAO" or "KAKAO_BOOK" or "KAKAO_BOOKS" => "KAKAO",
        "NAVER" or "NAVER_BOOK" or "NAVER_BOOKS" => "NAVER",
        "GOOGLE_BOOKS" or "GBOOKS" or "GOOGLE" => "GOOGLE_BOOKS",
        _ => "LOCAL"
    };

    public static bool IsExternalProvider(string? normalizedServerProvider) =>
        normalizedServerProvider is "TMDB" or "KAKAO" or "NAVER" or "GOOGLE_BOOKS";

    public static string? BuildExternalKey(TitleSummary title)
    {
        var provider = NormalizeServerProvider(title.Provider);
        if (!IsExternalProvider(provider) || string.IsNullOrWhiteSpace(title.ProviderId))
        {
            return null;
        }
        return $"{provider}:{title.ProviderId.Trim()}";
    }

    public static bool AreTitlesEquivalent(TitleSummary a, TitleSummary b)
    {
        if (string.Equals(a.Id, b.Id, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var keyA = BuildExternalKey(a);
        var keyB = BuildExternalKey(b);
        if (keyA != null && keyB != null && string.Equals(keyA, keyB, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (a.Type == TitleType.book && b.Type == TitleType.book)
        {
            var isbn13A = BookshelfBuilder.ExtractIsbn13(a);
            var isbn13B = BookshelfBuilder.ExtractIsbn13(b);
            if (isbn13A != null && isbn13B != null && string.Equals(isbn13A, isbn13B, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var isbn10A = BookshelfBuilder.ExtractIsbn10(a);
            var isbn10B = BookshelfBuilder.ExtractIsbn10(b);
            if (isbn10A != null && isbn10B != null && string.Equals(isbn10A, isbn10B, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static string NormalizeUtcIso(string? rawIso, string? fallbackIso = null)
    {
        if (TryParseUtc(rawIso, out var dto))
        {
            return dto.ToString("O", CultureInfo.InvariantCulture);
        }

        if (TryParseUtc(fallbackIso, out var fallbackDto))
        {
            return fallbackDto.ToString("O", CultureInfo.InvariantCulture);
        }

        return DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture);
    }

    public static bool TryParseUtc(string? rawIso, out DateTimeOffset utc)
    {
        if (!string.IsNullOrWhiteSpace(rawIso) &&
            DateTimeOffset.TryParse(
                rawIso.Trim(),
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var parsed))
        {
            utc = parsed.ToUniversalTime();
            return true;
        }

        utc = default;
        return false;
    }

    public static bool TryResolveServerDeletedEffectiveUtc(SyncDeletedLog deletedLog, out DateTimeOffset effectiveUtc)
    {
        var hasDeleted = TryParseUtc(deletedLog.DeletedAt, out var deletedUtc);
        var hasUpdated = TryParseUtc(deletedLog.UpdatedAt, out var updatedUtc);
        if (hasDeleted && hasUpdated)
        {
            effectiveUtc = deletedUtc >= updatedUtc ? deletedUtc : updatedUtc;
            return true;
        }
        if (hasDeleted)
        {
            effectiveUtc = deletedUtc;
            return true;
        }
        if (hasUpdated)
        {
            effectiveUtc = updatedUtc;
            return true;
        }
        effectiveUtc = default;
        return false;
    }
}
