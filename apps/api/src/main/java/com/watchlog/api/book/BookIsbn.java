package com.watchlog.api.book;

/** Validated edition identifiers shared by search and legacy title matching. */
public record BookIsbn(String isbn10, String isbn13) {
    public static BookIsbn parse(String raw) {
        String ten = null;
        String thirteen = null;
        for (String part : (raw == null ? "" : raw).trim().split("\\s+")) {
            String value = part.replace("-", "").toUpperCase(java.util.Locale.ROOT);
            if (valid13(value)) thirteen = value;
            else if (valid10(value)) ten = value;
        }
        if (thirteen == null && ten != null) {
            String prefix = "978" + ten.substring(0, 9);
            thirteen = prefix + check13(prefix);
        }
        // A 979 ISBN has no ISBN-10 equivalent. Never combine different editions.
        if (thirteen != null) {
            ten = null;
            if (thirteen.startsWith("978")) {
                String prefix = thirteen.substring(3, 12);
                int sum = 0;
                for (int i = 0; i < 9; i++) sum += (prefix.charAt(i) - '0') * (10 - i);
                int check = (11 - sum % 11) % 11;
                ten = prefix + (check == 10 ? "X" : Integer.toString(check));
            }
        }
        return new BookIsbn(ten, thirteen);
    }

    private static boolean valid10(String value) {
        if (!value.matches("[0-9]{9}[0-9X]")) return false;
        int sum = 0;
        for (int i = 0; i < 10; i++) sum += (value.charAt(i) == 'X' ? 10 : value.charAt(i) - '0') * (10 - i);
        return sum % 11 == 0;
    }

    private static boolean valid13(String value) {
        return value.matches("97[89][0-9]{10}") && check13(value.substring(0, 12)) == value.charAt(12) - '0';
    }

    private static int check13(String prefix) {
        int sum = 0;
        for (int i = 0; i < 12; i++) sum += (prefix.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
        return (10 - sum % 10) % 10;
    }
}
