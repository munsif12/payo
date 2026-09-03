from app.lang import has_arabic_script, has_devanagari_script, reply_language


def test_has_arabic_script_true_for_urdu_text():
    assert has_arabic_script("میرا بیلنس کیا ہے؟") is True


def test_has_arabic_script_false_for_english_and_roman_urdu():
    assert has_arabic_script("What is my balance?") is False
    assert has_arabic_script("bijli ka bill pay karna hai") is False


def test_has_arabic_script_false_for_empty_or_none():
    assert has_arabic_script("") is False
    assert has_arabic_script(None) is False


def test_has_devanagari_script_true_and_false():
    assert has_devanagari_script("नमस्ते, मेरा बैलेंस क्या है") is True
    assert has_devanagari_script("میرا بیلنس") is False
    assert has_devanagari_script("hello") is False


def test_reply_language_arabic_script_input_forces_urdu_regardless_of_ui_language():
    assert reply_language("میرا بیلنس کیا ہے؟", "en") == "ur"
    assert reply_language("میرا بیلنس کیا ہے؟", "ur") == "ur"


def test_reply_language_roman_urdu_input_follows_ui_language():
    assert reply_language("bijli ka bill pay karna hai", "en") == "en"
    assert reply_language("bijli ka bill pay karna hai", "ur") == "ur"


def test_reply_language_english_input_follows_ui_language():
    assert reply_language("What is my balance?", "en") == "en"
    assert reply_language("What is my balance?", "ur") == "ur"
