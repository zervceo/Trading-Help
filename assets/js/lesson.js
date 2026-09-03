/*
 * lesson.js — shared logic for every /strategies/*.html lesson page.
 * Expects window.LESSON_ID to be set by an inline script before this loads.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var id = window.LESSON_ID;
    var btn = document.getElementById('complete-btn');
    if (!id || !btn) return;

    function render() {
      var done = VTAStrategies.isComplete(id);
      btn.textContent = done ? '✓ Lesson Complete' : 'Mark Lesson Complete';
      btn.classList.toggle('btn-buy', done);
      btn.classList.toggle('btn-ghost', !done);
    }

    btn.addEventListener('click', function () {
      VTAStrategies.setComplete(id, !VTAStrategies.isComplete(id));
      render();
    });

    render();
  });
})();
